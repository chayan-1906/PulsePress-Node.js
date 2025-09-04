import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_TAG_GENERATION_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {ITagGenerationParams, ITagGenerationResponse} from "../types/ai";
import {validateAndProcessTags} from "../utils/serviceHelpers/tagHelpers";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";

class TagGenerationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate relevant tags for news article content using Gemini AI
     */
    static async generateTags({content, url}: ITagGenerationParams): Promise<ITagGenerationResponse> {
        console.log('Service: TagGenerationService.generateTags called'.cyan.italic, {content, url});

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
            console.log('Scraping URL for tag generation:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for caption generation'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits - use title and description primarily
        const truncatedContent = truncateContentForAI(articleContent, 4000);

        for (let i = 0; i < AI_TAG_GENERATION_MODELS.length; i++) {
            const modelName = AI_TAG_GENERATION_MODELS[i];
            console.log(`Trying tag generation with model ${i + 1}/${AI_TAG_GENERATION_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.generateWithGemini(modelName, truncatedContent);

                if (result.tags && result.tags.length > 0) {
                    console.log(`Tag generation successful with model:`.cyan, modelName);
                    console.log('Tag generation completed successfully'.green.bold, {caption: result.tags, model: modelName});
                    return {...result, powered_by: modelName};
                }

                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', error.message);
            }
        }

        console.error('Service Error: All tag generation models failed'.red.bold);
        return {error: 'TAG_GENERATION_FAILED'};
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
