import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_GEOGRAPHIC_EXTRACTION_MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAIGeographicExtraction, IGeographicExtractionParams, IGeographicExtractionResponse} from "../types/ai";

class GeographicExtractionService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Extract geographic locations from news article content using Gemini AI
     */
    static async extractLocations({email, content, url}: IGeographicExtractionParams): Promise<IGeographicExtractionResponse> {
        console.log('Service: GeographicExtractionService.extractLocations called'.cyan.italic, {email, content, url});

        const {isBlocked, blockType, blockedUntil, message: blockMessage} = await StrikeService.checkUserBlock(email);
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
            console.warn('Client Error: Both content and URL missing'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Both content and URL provided'.yellow, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
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
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike(email, 'ai_enhancement', articleContent);
            return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
        } else {
            console.log('News content verified, proceeding with geographic extraction'.bgGreen.bold);
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        for (let i = 0; i < AI_GEOGRAPHIC_EXTRACTION_MODELS.length; i++) {
            const modelName = AI_GEOGRAPHIC_EXTRACTION_MODELS[i];
            console.log(`Trying geographic extraction with model ${i + 1}/${AI_GEOGRAPHIC_EXTRACTION_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.extractWithGemini(modelName, truncatedContent);

                if (result.locations && result.locations.length > 0) {
                    console.log(`✅ Geographic extraction successful with model:`.cyan, modelName);
                    console.log('Extracted locations:'.cyan, result.locations);
                    console.log('Geographic extraction completed successfully'.green.bold);
                    return {...result, powered_by: modelName};
                }

                console.error('Service Error: Geographic extraction model failed'.red.bold, {model: modelName, error: result.error});
            } catch (error: any) {
                console.error('Service Error: Geographic extraction model failed'.red.bold, {model: modelName, error: error.message});
            }
        }

        console.error('Service Error: All geographic extraction models failed'.red.bold);
        return {error: 'GEOGRAPHIC_EXTRACTION_FAILED'};
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
