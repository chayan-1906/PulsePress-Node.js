import "colors";
import {createHash} from "crypto";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from "@google-cloud/translate/build/src/v2";
import AuthService from "./AuthService";
import NewsService from "./NewsService";
import StrikeService from "./StrikeService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {GEMINI_API_KEY, GEMINI_QUOTA_MS, GEMINI_QUOTA_REQUESTS, GOOGLE_TRANSLATE_API_KEY, NODE_ENV} from "../config/config";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IGenerateContentHashParams,
    IGenerateContentHashResponse,
    IGetCachedSummaryParams,
    ISaveSummaryToCacheParams,
    ISummarizeArticleParams,
    ISummarizeArticleResponse,
    ISummarizeContentParams,
    ISummarizeContentResponse,
    ITranslateTextParams,
    SUMMARIZATION_STYLES
} from "../types/ai";

class SummarizationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    private static readonly translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

    static geminiRequestCount = 0;

    private static resetInterval = setInterval(() => {
        this.geminiRequestCount = 0;
        console.log('Daily Gemini API counter reset'.blue);
    }, Number.parseInt(GEMINI_QUOTA_MS!));

    /**
     * Clean up the Gemini API request counter reset interval
     */
    static cleanup(): void {
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
        }
    }

    /**
     * Main entry point for article summarization with authentication, rate limiting, caching, and translation support
     */
    static async summarizeArticle({email, content, url, language = 'en', style = 'standard'}: ISummarizeArticleParams): Promise<ISummarizeArticleResponse> {
        console.log('Service: SummarizationService.summarizeArticle called'.cyan.italic, {content, url, language, style});

        try {
            if (!content && !url) {
                console.warn('Client Error: Both content and URL are invalid'.yellow, {content, url});
                return {error: 'CONTENT_OR_URL_REQUIRED'};
            }

            if (content && url) {
                console.warn('Client Error: Both content and URL provided'.yellow, {content, url});
                return {error: 'CONTENT_AND_URL_CONFLICT'};
            }

            if (style && !SUMMARIZATION_STYLES.includes(style)) {
                console.warn('Service Warning: Invalid summarization style'.yellow, style);
                return {error: generateInvalidCode('style')};
            }

            // Check user authentication
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            // Check if user is blocked
            const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
            if (isBlocked) {
                console.warn('Service Warning: User blocked from AI summarization'.yellow, {message, blockedUntil, blockType});
                return {
                    error: 'USER_BLOCKED_FROM_AI_FEATURES',
                    errorMsg: message || 'You are temporarily blocked from using AI features due to non-news queries',
                };
            }

            // Check rate limits
            if (this.geminiRequestCount >= Number.parseInt(GEMINI_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: Gemini API daily quota reached'.yellow);
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            }

            // Determine content to use
            const articleContent = content || '';

            // Generate hash and check cache
            const {hash} = await this.generateContentHash({articleContent, language, style});
            if (!hash) {
                return {error: 'HASH_FAILED'};
            }

            const cached = await this.getCachedSummary({contentHash: hash});
            if (cached) {
                console.log('Using cached summarization result'.cyan);
                return {
                    summary: cached.summary,
                    powered_by: 'Cached Result',
                };
            }

            // Generate summary using core summarization logic
            const {summary, powered_by, error} = await this.summarizeContent({content: articleContent, url, style});

            if (error) {
                console.error('Service Error: Core summarization failed'.red.bold, {error});
                return {error};
            }

            if (!summary) {
                return {error: 'SUMMARIZATION_FAILED'};
            }

            // Increment API counter
            this.geminiRequestCount++;
            console.log(`Gemini API request ${this.geminiRequestCount}/${GEMINI_QUOTA_REQUESTS}:`.cyan, 'summarization');

            let finalSummary = summary;
            let finalPoweredBy = powered_by;

            // Translate if needed
            if (language !== 'en') {
                console.log('Translating summary to target language:'.cyan, language);
                finalSummary = await this.translateText({text: summary, targetLanguage: language});
                finalPoweredBy = `${powered_by} + Translate`;
            }

            // Save to cache
            await this.saveSummaryToCache({
                contentHash: hash,
                summary: finalSummary,
                language,
                style
            });

            console.log('Article summarization completed successfully'.green.bold, {summary: finalSummary.substring(0, 50) + '...', powered_by: finalPoweredBy});

            return {
                summary: finalSummary,
                powered_by: finalPoweredBy,
            };
        } catch (error: any) {
            console.error('Service Error: SummarizationService.summarizeArticle failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Core summarization logic using Gemini AI
     */
    static async summarizeContent({content, url, style = 'standard'}: ISummarizeContentParams): Promise<ISummarizeContentResponse> {
        console.log('Service: SummarizationService.summarizeContent called'.cyan.italic, {content, url, style});

        if (!content && !url) {
            console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Content and url both valid'.yellow, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        if (style && !SUMMARIZATION_STYLES.includes(style)) {
            console.warn('Client Error: Invalid summarization style'.yellow, {style});
            return {error: 'INVALID_STYLE'};
        }

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

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 8000);

        for (let i = 0; i < AI_SUMMARIZATION_MODELS.length; i++) {
            const modelName = AI_SUMMARIZATION_MODELS[i];
            console.log(`Trying summarization with model ${i + 1}/${AI_SUMMARIZATION_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.summarizeWithGemini(modelName, truncatedContent, style);

                if (result.summary) {
                    console.log(`Summarization successful with model:`.cyan, modelName);
                    console.log('Content summarization completed successfully'.green.bold, {summary: result.summary.substring(0, 50) + '...', model: modelName});
                    return {...result, powered_by: modelName};
                }

                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', error.message);
            }
        }

        console.error('Service Error: All summarization models failed'.red.bold);
        return {error: 'SUMMARIZATION_FAILED'};
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
     * Generate SHA256 hash for article content with language and style parameters
     */
    static async generateContentHash({articleContent, language = 'en', style = 'standard'}: IGenerateContentHashParams): Promise<IGenerateContentHashResponse> {
        console.log('Service: SummarizationCacheService.generateContentHash called'.cyan.italic, {articleContent: articleContent.substring(0, 50) + '...', language, style});

        try {
            if (!articleContent) {
                return {error: generateMissingCode('content')};
            }

            const data = `${articleContent}::${language}::${style}`;
            const contentHash = createHash('sha256').update(data).digest('hex');
            console.log('Content hash generated:'.cyan, contentHash);

            return {hash: contentHash};
        } catch (error: any) {
            console.error('Service Error: SummarizationCacheService.generateContentHash failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Save generated summary to cache with content hash and metadata
     */
    static async saveSummaryToCache({contentHash, summary, language, style}: ISaveSummaryToCacheParams): Promise<ICachedSummary | null> {
        console.log('Service: SummarizationCacheService.saveSummaryToCache called'.cyan.italic, {contentHash, summary: summary.substring(0, 50) + '...', language, style});

        try {
            if (NODE_ENV !== 'production') {
                console.log('Caching disabled in development mode'.cyan);
                return null;
            }

            const savedContentHash: ICachedSummary | null = await CachedSummaryModel.create({contentHash, summary, language, style});
            console.log('Saved content hash to cache:'.cyan, savedContentHash);
            return savedContentHash;
        } catch (error: any) {
            console.error('Service Error: SummarizationCacheService.saveSummaryToCache failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Retrieve cached summary by content hash
     */
    static async getCachedSummary({contentHash}: IGetCachedSummaryParams): Promise<ICachedSummary | null> {
        console.log('Service: SummarizationCacheService.getCachedSummary called'.cyan.italic, {contentHash});

        try {
            if (NODE_ENV !== 'production') {
                console.log('Caching disabled in development mode'.cyan);
                return null;
            }

            const cachedSummary: ICachedSummary | null = await CachedSummaryModel.findOne({contentHash});
            console.log('Retrieved cached summary:'.cyan, cachedSummary ? 'Found' : 'Not found');
            return cachedSummary;
        } catch (error: any) {
            console.error('Service Error: SummarizationCacheService.getCachedSummary failed'.red.bold, error);
            return null;
        }
    }

    /**
     * Translate text to target language using Google Translate API
     */
    static async translateText({text, targetLanguage}: ITranslateTextParams): Promise<string> {
        console.log('Service: SummarizationCacheService.translateText called'.cyan.italic, {text: text.substring(0, 50) + '...', targetLanguage});

        try {
            if (!GOOGLE_TRANSLATE_API_KEY) {
                console.warn('Config Warning: Google Translate API key not configured'.yellow.italic);
                return text; // fallback to original text
            }

            console.log('External API: Translating text using Google Translate'.magenta);
            const [translation] = await this.translate.translate(text, {
                to: targetLanguage, // 'bn' for Bengali, 'hi' for Hindi, etc.
            });
            console.log('Translation completed:'.cyan, translation.substring(0, 50) + '...');
            return translation;
        } catch (error: any) {
            console.error('Service Error: SummarizationCacheService.translateText failed'.red.bold, error);
            return text; // fallback to original text
        }
    }
}

export default SummarizationService;
