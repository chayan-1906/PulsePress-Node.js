import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import AuthService from "./AuthService";
import NewsService from "./NewsService";
import StrikeService from "./StrikeService";
import QuotaService from "./QuotaService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import NewsClassificationService from "./NewsClassificationService";
import {translateText} from "../utils/serviceHelpers/translationHelpers";
import {AI_SUMMARIZATION_MODELS, API_CONFIG, CONTENT_LIMITS} from "../utils/constants";
import {truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {getCachedSummaryVariation, saveSummaryVariation} from "../utils/serviceHelpers/cacheHelpers";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ISummarizeArticleParams, ISummarizeArticleResponse, ISummarizeContentResponse, ISummarizeContentWithModelParams, SUMMARIZATION_STYLES} from "../types/ai";

class SummarizationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Main entry point for article summarization with authentication, rate limiting, caching, and translation support
     */
    static async summarizeArticle({email, content, url, language = 'en', style = 'standard'}: ISummarizeArticleParams): Promise<ISummarizeArticleResponse> {
        console.log('Service: SummarizationService.summarizeArticle called'.cyan.italic, {content, url, language, style});

        try {
            if (!url) {
                console.warn('Client Error: URL is invalid'.yellow, {content, url});
                return {error: generateMissingCode('url')};
            }

            if (style && !SUMMARIZATION_STYLES.includes(style)) {
                console.warn('Service Warning: Invalid summarization style'.yellow, style);
                return {error: generateInvalidCode('style')};
            }

            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock({email});
            if (isBlocked) {
                console.warn('Service Warning: User blocked from AI summarization'.yellow, {message, blockedUntil, blockType});
                return {
                    error: 'USER_BLOCKED_FROM_AI_FEATURES',
                    message: message || 'You are temporarily blocked from using AI features due to non-news queries',
                };
            }

            const articleContent = content || '';
            const articleId = generateArticleId({url});

            console.log('External API: Validating news content classification'.magenta);
            const classification = await NewsClassificationService.classifyContent(articleContent);

            if (classification === 'error') {
                console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
            } else if (classification === 'non_news') {
                console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
                const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike({email, violationType: 'article_summary', content: articleContent});
                return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
            } else {
                console.log('News content verified, proceeding with summarization'.bgGreen.bold);
            }

            const cached = await getCachedSummaryVariation({articleId, style, language});
            if (cached) {
                console.log('Using cached summarization result'.cyan);
                return {summary: cached.content, powered_by: 'Cached Result'};
            }

            const quotaReservation = await QuotaService.reserveQuotaForModelFallback({primaryModel: AI_SUMMARIZATION_MODELS[0], fallbackModels: AI_SUMMARIZATION_MODELS.slice(1), count: 1});

            if (!quotaReservation.allowed) {
                console.warn('Rate Limit: Gemini API daily quota reached'.yellow, {
                    selectedModel: quotaReservation.selectedModel,
                    quotaReserved: quotaReservation.quotaReserved,
                    service: quotaReservation.service,
                });
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            }

            const {summary, powered_by, error} = await this.summarizeContentWithModel({content: articleContent, url, style, modelName: quotaReservation.selectedModel});

            if (error) {
                console.error('Service Error: Core summarization failed'.red.bold, {error});
                return {error};
            }

            if (!summary) {
                return {error: 'SUMMARIZATION_FAILED'};
            }

            console.log(`Gemini API request (quota reserved):`.cyan, {model: quotaReservation.selectedModel, quotaReserved: quotaReservation.quotaReserved});

            let finalSummary = summary;
            let finalPoweredBy = powered_by;

            if (language !== 'en') {
                console.log('Translating summary to target language:'.cyan, language);
                finalSummary = await translateText(summary, language);
                finalPoweredBy = `${powered_by} + Translate`;
            }

            await saveSummaryVariation({articleId, summary: finalSummary, url, style, language});

            console.log('Article summarization completed successfully'.green.bold, {summary: finalSummary.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...', powered_by: finalPoweredBy});

            return {summary: finalSummary, powered_by: finalPoweredBy};
        } catch (error: any) {
            console.error('Service Error: SummarizationService.summarizeArticle failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Summarize content using Gemini AI with specific style
     */
    private static async summarizeWithGemini(modelName: string, content: string, style: string): Promise<ISummarizeContentResponse> {
        console.log('Service: SummarizationService.summarizeWithGemini called'.cyan.italic, {modelName, content, style});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

        let prompt = '';
        if (style === 'concise') {
            prompt = AI_PROMPTS.SUMMARIZATION.CONCISE(content);
        } else if (style === 'standard') {
            prompt = AI_PROMPTS.SUMMARIZATION.STANDARD(content);
        } else if (style === 'detailed') {
            prompt = AI_PROMPTS.SUMMARIZATION.DETAILED(content);
        }

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        console.log('Gemini summarization response:'.cyan, responseText.substring(0, 100) + '...');

        if (!responseText || responseText.length === 0) {
            console.error('Service Error: Empty response from Gemini:'.red.bold, responseText);
            return {error: 'SUMMARIZATION_PARSE_ERROR'};
        }

        return {summary: responseText};
    }

    /**
     * Core summarization logic using a specific Gemini AI model (for quota-reserved calls)
     */
    private static async summarizeContentWithModel({content, url, style = 'standard', modelName}: ISummarizeContentWithModelParams): Promise<ISummarizeContentResponse> {
        console.log('Service: SummarizationService.summarizeContentWithModel called'.cyan.italic, {content, url, style, modelName});

        let articleContent = content || '';
        if (!content && url) {
            console.log('Scraping URL for summarization:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for summarization'.yellow);
            return {error: generateMissingCode('content')};
        }

        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        try {
            console.log(`Using quota-reserved model:`.cyan, modelName);
            const result = await this.summarizeWithGemini(modelName, truncatedContent, style);

            if (result.summary) {
                console.log('Content summarization completed successfully with reserved model'.green.bold, {
                    summary: result.summary.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...',
                    model: modelName,
                });
                return {...result, powered_by: modelName};
            }

            console.error(`Service Error: Quota-reserved model failed:`.red.bold, modelName, 'Error:', result.error);
            return {error: 'SUMMARIZATION_FAILED'};

        } catch (error: any) {
            console.error(`Service Error: Quota-reserved model failed:`.red.bold, modelName, 'Error:', error.message);
            return {error: 'SUMMARIZATION_FAILED'};
        }
    }
}

export default SummarizationService;
