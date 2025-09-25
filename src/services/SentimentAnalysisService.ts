import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import QuotaService from "./QuotaService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_SENTIMENT_ANALYSIS_MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {getCachedArticleEnhancements, hasEnhancementTypes, saveBasicEnhancements} from "../utils/serviceHelpers/cacheHelpers";
import {IAISentiment, ISentimentAnalysisParams, ISentimentAnalysisResponse, SENTIMENT_TYPES, TSentimentResult,} from "../types/ai";

class SentimentAnalysisService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes the sentiment of news article content using Gemini AI
     */
    static async analyzeSentiment({email, content, url}: ISentimentAnalysisParams): Promise<ISentimentAnalysisResponse> {
        console.log('Service: SentimentAnalysisService.analyzeSentiment called'.cyan.italic, {email, content, url});

        if (!url) {
            console.warn('Client Error: URL is invalid'.yellow, {content, url});
            return {error: generateMissingCode('url')};
        }

        const {isBlocked, blockType, blockedUntil, message: blockMessage} = await StrikeService.checkUserBlock({email});
        if (isBlocked) {
            console.warn('Client Error: User is blocked from AI features'.yellow, {email, blockType, blockedUntil});
            return {
                error: 'USER_BLOCKED',
                message: blockMessage || 'You are temporarily blocked from using AI features',
                isBlocked,
                blockedUntil,
                blockType,
            };
        }

        let articleContent = content || '';
        if (!content && url) {
            console.log('External API: Scraping URL for sentiment analysis'.magenta, {url});
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for sentiment analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        console.log('External API: Validating news content classification'.magenta);
        const classification = await NewsClassificationService.classifyContent(articleContent);

        if (classification === 'error') {
            console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
        } else if (classification === 'non_news') {
            console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike({email, violationType: 'ai_enhancement', content: articleContent});
            return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
        } else {
            console.log('News content verified, proceeding with sentiment analysis'.cyan);
        }

        const articleId = generateArticleId({url});

        const existingSentiment = await hasEnhancementTypes(articleId, ['sentiment']);
        if (existingSentiment.sentiment) {
            console.log('Using cached sentiment result'.cyan);
            const cachedEnhancements = await getCachedArticleEnhancements(articleId);
            return {
                sentiment: cachedEnhancements?.sentiment?.type,
                confidence: cachedEnhancements?.sentiment?.confidence || 0.5,
                powered_by: 'Cached Result',
            };
        }

        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const fallbackResult = await QuotaService.executeWithModelFallback({
            primaryModel: AI_SENTIMENT_ANALYSIS_MODELS[0],
            fallbackModels: AI_SENTIMENT_ANALYSIS_MODELS.slice(1),
            executeAICall: (modelName: string) => this.analyzeWithGemini(modelName, truncatedContent),
            count: 1,
        });

        if (!fallbackResult.success) {
            console.error('Service Error: All sentiment analysis models failed'.red.bold, {error: fallbackResult.error, attemptedModels: fallbackResult.attemptedModels});

            if (fallbackResult.error === 'QUOTA_EXHAUSTED') {
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            } else if (fallbackResult.error === 'ALL_AI_CALLS_FAILED') {
                return {error: 'SENTIMENT_ANALYSIS_FAILED'};
            } else {
                return {error: 'SENTIMENT_ANALYSIS_FAILED'};
            }
        }

        const result = fallbackResult.result!;
        const selectedModel = fallbackResult.selectedModel;

        if (result.sentiment && result.confidence) {
            const sentimentData = {
                type: result.sentiment,
                confidence: result.confidence,
                emoji: this.getSentimentEmoji(result.sentiment),
                color: this.getSentimentColor(result.sentiment),
            };

            await saveBasicEnhancements({articleId, url, sentiment: sentimentData});

            console.log('Sentiment analysis completed successfully'.green.bold, {
                sentiment: result.sentiment,
                confidence: result.confidence,
                model: selectedModel,
                attemptedModels: fallbackResult.attemptedModels.length
            });
            return {...result, powered_by: selectedModel};
        }

        console.error('Service Error: Invalid sentiment analysis result'.red.bold, {model: selectedModel, error: result.error, result});
        return {error: 'SENTIMENT_ANALYSIS_FAILED'};
    }

    /**
     * Analyze sentiment using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<ISentimentAnalysisResponse> {
        console.log('Service: SentimentAnalysisService.analyzeWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.SENTIMENT_ANALYSIS(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini sentiment analysis response:'.cyan, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAISentiment = JSON.parse(responseText);

        if (!parsed.sentiment || !SENTIMENT_TYPES.includes(parsed.sentiment)) {
            console.error('Service Error: Invalid sentiment value in response:'.red.bold, parsed.sentiment);
            return {error: 'SENTIMENT_PARSE_ERROR'};
        }

        const sentiment = parsed.sentiment as TSentimentResult;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

        return {sentiment, confidence};
    }

    private static getSentimentEmoji(sentiment: TSentimentResult): string {
        switch (sentiment) {
            case 'positive':
                return '😊';
            case 'negative':
                return '😔';
            case 'neutral':
                return '😐';
            default:
                return '😐';
        }
    }

    private static getSentimentColor(sentiment: TSentimentResult): string {
        switch (sentiment) {
            case 'positive':
                return 'green';
            case 'negative':
                return 'red';
            case 'neutral':
                return 'gray';
            default:
                return 'gray';
        }
    }
}

export default SentimentAnalysisService;
