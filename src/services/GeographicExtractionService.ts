import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AI_GEOGRAPHIC_EXTRACTION_MODELS} from "../utils/constants";
import {IAIGeographicExtraction, IGeographicExtractionParams, IGeographicExtractionResponse} from "../types/ai";

class GeographicExtractionService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Extract geographic locations from news article content using Gemini AI
     */
    static async extractLocations({content, url}: IGeographicExtractionParams): Promise<IGeographicExtractionResponse> {
        console.log('Service: GeographicExtractionService.extractLocations called'.cyan.italic, {contentLength: content?.length, url});

        if (!content && !url) {
            console.warn('Client Error: Both content and URL missing'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Both content and URL provided'.yellow, {contentLength: content.length, url});
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

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 4000);
        console.log('Content prepared for geographic extraction'.cyan, {originalLength: articleContent.length, truncatedLength: truncatedContent.length});

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

        if (responseText.startsWith('```json')) {
            responseText = responseText.substring(7);
        }
        if (responseText.startsWith('```')) {
            responseText = responseText.substring(3);
        }
        if (responseText.endsWith('```')) {
            responseText = responseText.substring(0, responseText.length - 3);
        }
        responseText = responseText.trim();

        if (responseText !== result.response.text().trim()) {
            console.log('JSON markdown stripped'.cyan, responseText);
        }

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
