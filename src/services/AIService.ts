import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from '@google-cloud/translate/build/src/v2';
import AuthService from "./AuthService";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import StrikeService from "./StrikeService";
import {AI_PROMPTS} from "../utils/prompts";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {GEMINI_API_KEY, GEMINI_QUOTA_MS, GEMINI_QUOTA_REQUESTS, GOOGLE_TRANSLATE_API_KEY, NODE_ENV} from "../config/config";
import {
    IGenerateContentHashParams,
    IGenerateContentHashResponse,
    IGetCachedSummaryParams,
    ISaveSummaryToCacheParams,
    SUMMARIZATION_STYLES,
    ISummarizeArticleParams,
    ISummarizeArticleResponse,
    ITranslateTextParams,
} from "../types/ai";

class AIService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    private static readonly translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

    static geminiRequestCount = 0;

    private static resetInterval = setInterval(() => {
        AIService.geminiRequestCount = 0;
        console.log('Daily Gemini API counter reset'.blue);
    }, Number.parseInt(GEMINI_QUOTA_MS!));

    static cleanup(): void {
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
        }
    }

    static async summarizeArticle({email, content, url, language = 'en', style = 'standard'}: ISummarizeArticleParams): Promise<ISummarizeArticleResponse> {
        console.log('Service: AIService.summarizeArticle called'.cyan.italic, {content, url});

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

            const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);

            if (isBlocked) {
                console.warn('Service Warning: User blocked from AI summarization'.yellow, {message, blockedUntil, blockType});
                return {
                    error: 'USER_BLOCKED_FROM_AI_FEATURES',
                    errorMsg: message || 'You are temporarily blocked from using AI features due to non-news queries',
                };
            }

            if (this.geminiRequestCount >= Number.parseInt(GEMINI_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: Gemini API daily quota reached'.yellow);
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            }

            let articleContent = content || '';
            if (!content && url) {
                console.log('Service: Processing URL for content scraping'.cyan);
                const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});
                if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                    console.error('Service Error: Article scraping failed'.red.bold, {count: scrapedArticles.length}, {error: scrapedArticles[0].error})
                    return {error: 'SCRAPING_FAILED'};
                }

                console.log('Service: Scraped article content'.cyan, scrapedArticles);
                articleContent = scrapedArticles[0]?.content || '';
            }

            if (!articleContent) {
                return {error: generateMissingCode('content')};
            }
            console.log('Service: Article content processed'.cyan, articleContent);

            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            // Generate hash and check cache
            const {hash} = await this.generateContentHash({articleContent, language, style});
            if (!hash) {
                return {error: 'HASH_FAILED'};
            }

            const cached = await this.getCachedSummary({contentHash: hash});

            if (NODE_ENV === 'production' && cached) {
                return {
                    summary: cached.summary,
                    powered_by: 'Cached Result',
                };
            }

            let usedModel, summarizedArticleResponse;

            let prompt = '';
            if (style === 'concise') {
                prompt = AI_PROMPTS.SUMMARIZATION.CONCISE(articleContent);
            } else if (style === 'standard') {
                prompt = AI_PROMPTS.SUMMARIZATION.STANDARD(articleContent);
            } else if (style === 'detailed') {
                prompt = AI_PROMPTS.SUMMARIZATION.DETAILED(articleContent);
            }

            for (const modelName of AI_SUMMARIZATION_MODELS) {
                try {
                    const model = this.genAI.getGenerativeModel({model: modelName});
                    summarizedArticleResponse = await model.generateContent(prompt);
                    usedModel = modelName;
                    this.geminiRequestCount++;
                    console.log(`Gemini API request ${this.geminiRequestCount}/1500:`.cyan, 'summarization');
                    break; // Success - exit loop
                } catch (error) {
                    if (modelName === AI_SUMMARIZATION_MODELS[AI_SUMMARIZATION_MODELS.length - 1]) {
                        throw error; // Last attempt failed
                    }
                }
            }

            const text = summarizedArticleResponse?.response.text();
            if (!text || text.trim() === '') {
                return {error: 'SUMMARIZATION_FAILED'};
            }

            let finalSummary = text;
            if (language !== 'en') {
                finalSummary = await this.translateText({text, targetLanguage: language});
            }

            // After AI generates summary, save to cache:
            if (NODE_ENV === 'production') {
                await this.saveSummaryToCache({contentHash: hash, summary: finalSummary, language, style});
            }

            console.log('Article summarized'.green.bold, {summary: finalSummary.substring(0, 50) + '...'});
            return {
                summary: finalSummary,
                powered_by: usedModel + (language !== 'en' ? ' + Translate' : ''),
            };
        } catch (error: any) {
            console.error('Service Error: AIService.summarizeArticle failed'.red.bold, error);
            throw error;
        }
    }

    private static async generateContentHash({articleContent, language = 'en', style = 'standard'}: IGenerateContentHashParams): Promise<IGenerateContentHashResponse> {
        console.log('Service: AIService.generateContentHash called'.cyan.italic, {articleContent: articleContent.substring(0, 50) + '...', language, style});

        try {
            if (!articleContent) {
                return {error: generateMissingCode('content')};
            }

            const data = `${articleContent}::${language}::${style}`;
            const contentHash = createHash('sha256').update(data).digest('hex');
            console.log('content hash generated:'.cyan, contentHash);

            return {hash: contentHash};
        } catch (error: any) {
            console.error('Service Error: AIService.generateContentHash failed'.red.bold, error);
            throw error;
        }
    }

    private static async saveSummaryToCache({contentHash, summary, language, style}: ISaveSummaryToCacheParams): Promise<ICachedSummary | null> {
        console.log('Service: AIService.saveSummaryToCache called'.cyan.italic, {contentHash, summary: summary.substring(0, 50) + '...', language, style});

        try {
            const savedContentHash: ICachedSummary | null = await CachedSummaryModel.create({contentHash, summary, language, style});
            console.log('saved content hash'.cyan, savedContentHash);
            return savedContentHash;
        } catch (error: any) {
            console.error('Service Error: AIService.saveSummaryToCache failed'.red.bold, error);
            throw error;
        }
    }

    private static async getCachedSummary({contentHash}: IGetCachedSummaryParams): Promise<ICachedSummary | null> {
        console.log('Service: AIService.getCachedSummary called'.cyan.italic, {contentHash});

        const cachedSummary: ICachedSummary | null = await CachedSummaryModel.findOne({contentHash});
        console.log('cachedSummary'.cyan, cachedSummary);
        return cachedSummary;
    }

    private static async translateText({text, targetLanguage}: ITranslateTextParams): Promise<string> {
        console.log('Service: AIService.translateText called'.cyan.italic, {text, targetLanguage});

        try {
            const [translation] = await this.translate.translate(text, {
                to: targetLanguage, // 'bn' for Bengali, 'hi' for Hindi, etc.
            });
            console.log('translation:'.cyan, translation);
            return translation;
        } catch (error: any) {
            console.error('Service Error: AIService.translateText failed'.red.bold, error);
            return text; // fallback to original text
        }
    }
}

export default AIService;
