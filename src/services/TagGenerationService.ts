import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import QuotaService from "./QuotaService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_TAG_GENERATION_MODELS, API_CONFIG} from "../utils/constants";
import {ITagGenerationParams, ITagGenerationResponse} from "../types/ai";
import {validateAndProcessTags} from "../utils/serviceHelpers/tagHelpers";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {getCachedArticleEnhancements, hasEnhancementTypes, saveBasicEnhancements} from "../utils/serviceHelpers/cacheHelpers";

class TagGenerationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate relevant tags for news article content using Gemini AI
     */
    static async generateTags({email, content, url}: ITagGenerationParams): Promise<ITagGenerationResponse> {
        console.log('Service: TagGenerationService.generateTags called'.cyan.italic, {email, content, url});

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
            console.log('Scraping URL for tag generation:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for tag generation'.yellow);
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
            console.log('News content verified, proceeding with tag generation'.bgGreen.bold);
        }

        const articleId = generateArticleId({url});

        const existingTags = await hasEnhancementTypes(articleId, ['tags']);
        if (existingTags.tags) {
            console.log('Using cached tag result'.cyan);
            const cachedEnhancements = await getCachedArticleEnhancements(articleId);
            return {
                tags: cachedEnhancements?.tags || [],
                powered_by: 'Cached Result',
            };
        }

        // Truncate content to avoid token limits - use title and description primarily
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: AI_TAG_GENERATION_MODELS[0],
            fallbackModels: AI_TAG_GENERATION_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for tag generation'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for tag generation'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.generateWithGemini(selectedModel, truncatedContent);

            if (result.tags && result.tags.length > 0) {
                await saveBasicEnhancements({articleId, url, tags: result.tags});

                console.log('Tag generation completed successfully'.green.bold, {tags: result.tags, model: selectedModel});
                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Tag generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'TAG_GENERATION_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Tag generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'TAG_GENERATION_FAILED'};
        }
    }

    /**
     * Generate tags using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string): Promise<ITagGenerationResponse> {
        console.log('Service: TagGenerationService.generateWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.TAG_GENERATION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini tag generation response:'.cyan, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        try {
            const parsed: string[] = JSON.parse(responseText);

            const validTags = validateAndProcessTags(parsed, 5);

            if (validTags.length === 0) {
                return {error: 'NO_VALID_TAGS'};
            }

            return {tags: validTags, powered_by: modelName};
        } catch (error: any) {
            console.error('Service Error: Tag generation parsing failed:'.red.bold, error.message);
            return {error: 'TAG_PARSE_ERROR'};
        }
    }
}

export default TagGenerationService;
