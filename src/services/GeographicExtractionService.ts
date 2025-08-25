import "colors";
import {genAI} from "./AIService";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AI_GEOGRAPHIC_EXTRACTION_MODELS} from "../utils/constants";
import {AIGeographicExtraction, GeographicExtractionParams, GeographicExtractionResponse} from "../types/ai";

class GeographicExtractionService {
    /**
     * Extract geographic locations from news article content using Gemini AI
     */
    static async extractLocations({content, url}: GeographicExtractionParams): Promise<GeographicExtractionResponse> {
        console.log('Extracting geographic locations from content...'.cyan.italic);

        if (!content && !url) {
            console.error('Content and url both invalid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.error('Content and url both valid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.info('Scraping URL for geographic extraction:'.cyan.italic, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.log('Empty content provided for geographic extraction'.yellow.italic);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 4000);

        for (let i = 0; i < AI_GEOGRAPHIC_EXTRACTION_MODELS.length; i++) {
            const model = AI_GEOGRAPHIC_EXTRACTION_MODELS[i];
            console.log(`Trying geographic extraction with model ${i + 1}/${AI_GEOGRAPHIC_EXTRACTION_MODELS.length}:`.cyan, model);

            try {
                const result = await this.extractWithGemini(model, truncatedContent);

                if (result.locations && result.locations.length > 0) {
                    console.log(`✅ Geographic extraction successful with model:`.green, model);
                    console.log('Extracted locations:'.green, result.locations);
                    return result;
                }

                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, result.error);
            } catch (error: any) {
                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, error.message);
            }
        }

        console.error('🚨 All geographic extraction models failed'.red.bold);
        return {error: 'GEOGRAPHIC_EXTRACTION_FAILED'};
    }

    /**
     * Extract geographic locations using Gemini AI
     */
    private static async extractWithGemini(modelName: string, content: string): Promise<GeographicExtractionResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.GEOGRAPHIC_EXTRACTION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini geographic extraction response:'.cyan, responseText);

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
            console.log('Stripped markdown, clean JSON:'.yellow, responseText);
        }

        const parsed: AIGeographicExtraction = JSON.parse(responseText);

        if (!parsed.locations || !Array.isArray(parsed.locations)) {
            console.error('Invalid locations array in response:'.red, parsed.locations);
            return {error: 'GEOGRAPHIC_PARSE_ERROR'};
        }

        const validLocations = parsed.locations.filter(location => location && location.trim().length > 0);

        if (validLocations.length === 0) {
            console.error('No valid locations found in response'.red);
            return {error: 'NO_VALID_LOCATIONS'};
        }

        return {locations: validLocations};
    }
}

export default GeographicExtractionService;
