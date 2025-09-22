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
import {AI_GEOGRAPHIC_EXTRACTION_MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAIGeographicExtraction, IGeographicExtractionParams, IGeographicExtractionResponse} from "../types/ai";
import {getCachedArticleEnhancements, hasEnhancementTypes, saveBasicEnhancements} from "../utils/serviceHelpers/cacheHelpers";

class GeographicExtractionService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Extract geographic locations from news article content using Gemini AI
     */
    static async extractLocations({email, content, url}: IGeographicExtractionParams): Promise<IGeographicExtractionResponse> {
        console.log('Service: GeographicExtractionService.extractLocations called'.cyan.italic, {email, content, url});

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
            console.log('Content scraping required for URL'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Article scraping failed'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for geographic extraction'.yellow);
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
            console.log('News content verified, proceeding with geographic extraction'.bgGreen.bold);
        }

        const articleId = generateArticleId({url});

        const existingLocations = await hasEnhancementTypes(articleId, ['locations']);
        if (existingLocations.locations) {
            console.log('Using cached locations result'.cyan);
            const cachedEnhancements = await getCachedArticleEnhancements(articleId);
            return {
                locations: cachedEnhancements?.locations || [],
                powered_by: 'Cached Result',
            };
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: AI_GEOGRAPHIC_EXTRACTION_MODELS[0],
            fallbackModels: AI_GEOGRAPHIC_EXTRACTION_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for geographic extraction'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for geographic extraction'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.extractWithGemini(selectedModel, truncatedContent);

            if (result.locations && result.locations.length > 0) {
                await saveBasicEnhancements({articleId, url, locations: result.locations});

                console.log('Geographic extraction completed successfully'.green.bold, {locations: result.locations, model: selectedModel});
                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Geographic extraction failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'GEOGRAPHIC_EXTRACTION_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Geographic extraction failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'GEOGRAPHIC_EXTRACTION_FAILED'};
        }
    }

    /**
     * Extract geographic locations using Gemini AI
     */
    private static async extractWithGemini(modelName: string, content: string): Promise<IGeographicExtractionResponse> {
        console.log('Service: GeographicExtractionService.extractWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating geographic extraction with Gemini'.magenta, {model: modelName});
        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.GEOGRAPHIC_EXTRACTION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAIGeographicExtraction = JSON.parse(responseText);

        if (!parsed.locations || !Array.isArray(parsed.locations)) {
            console.error('Service Error: Invalid locations array in response'.red.bold, parsed.locations);
            return {error: 'GEOGRAPHIC_PARSE_ERROR'};
        }

        const validLocations = parsed.locations.filter(location => location && location.trim().length > 0);

        if (validLocations.length === 0) {
            console.error('Service Error: No valid locations found in response'.red.bold);
            return {error: 'NO_VALID_LOCATIONS'};
        }

        console.log('Geographic locations parsed successfully'.cyan, validLocations);
        return {locations: validLocations};
    }
}

export default GeographicExtractionService;
