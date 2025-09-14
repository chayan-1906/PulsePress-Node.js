import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_SENTIMENT_ANALYSIS_MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAISentiment, ISentimentAnalysisParams, ISentimentAnalysisResponse, SENTIMENT_TYPES, TSentimentResult,} from "../types/ai";

class SentimentAnalysisService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes the sentiment of news article content using Gemini AI
     */
    static async analyzeSentiment({email, content, url}: ISentimentAnalysisParams): Promise<ISentimentAnalysisResponse> {
        console.log('Service: SentimentAnalysisService.analyzeSentiment called'.cyan.italic, {email, content, url});

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

        if (!content && !url) {
            console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Content and url both valid'.yellow, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
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

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        for (let i = 0; i < AI_SENTIMENT_ANALYSIS_MODELS.length; i++) {
            const model = AI_SENTIMENT_ANALYSIS_MODELS[i];
            console.log(`Trying sentiment analysis with model ${i + 1}/${AI_SENTIMENT_ANALYSIS_MODELS.length}:`.cyan, model);

            try {
                let result: ISentimentAnalysisResponse;
                result = await this.analyzeWithGemini(model, truncatedContent);

                if (result.sentiment && result.confidence) {
                    console.log(`Sentiment analysis successful with model:`.cyan, model);
                    console.log('Sentiment analysis completed successfully'.green.bold, {sentiment: result.sentiment, confidence: result.confidence});

                    return {...result, powered_by: model};
                }

                console.error(`Service Error: Model failed:`.red.bold, model, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, model, 'Error:', error.message);
            }
        }

        console.error('Service Error: All sentiment analysis models failed'.red.bold);
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
}

export default SentimentAnalysisService;
