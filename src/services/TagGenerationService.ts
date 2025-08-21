import "colors";
import {genAI} from "./AIService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {scrapeMultipleArticles} from "./NewsService";
import {AI_TAG_GENERATION_MODELS} from "../utils/constants";
import {TagGenerationParams, TagGenerationResponse} from "../types/ai";

class TagGenerationService {
    /**
     * Generate relevant tags for news article content using Gemini AI
     */
    static async generateTags({content, url}: TagGenerationParams): Promise<TagGenerationResponse> {
        console.log('Generating tags for content...'.cyan.italic);

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
            console.info('Scraping URL for tag generation:'.cyan.italic, url);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.log('Empty content provided for tag generation'.yellow.italic);
            return {error: 'EMPTY_CONTENT'};
        }

        // Truncate content to avoid token limits - use title and description primarily
        const truncatedContent = articleContent.substring(0, 3000);

        for (let i = 0; i < AI_TAG_GENERATION_MODELS.length; i++) {
            const model = AI_TAG_GENERATION_MODELS[i];
            console.log(`Trying tag generation with model ${i + 1}/${AI_TAG_GENERATION_MODELS.length}:`.cyan, model);

            try {
                const result = await this.generateWithGemini(model, truncatedContent);

                if (result.tags && result.tags.length > 0) {
                    console.log(`✅ Tag generation successful with model:`.green, model);
                    console.log('Generated tags:'.green, result.tags);
                    return result;
                }

                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, result.error);
            } catch (error: any) {
                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, error.message);
            }
        }

        console.error('🚨 All tag generation models failed'.red.bold);
        return {error: 'TAG_GENERATION_FAILED'};
    }

    /**
     * Generate tags using Gemini AI
     */
    static async generateWithGemini(modelName: string, content: string): Promise<TagGenerationResponse> {
        const model = genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.TAG_GENERATION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini tag generation response:'.cyan, responseText);

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

        try {
            const parsed: string[] = JSON.parse(responseText);

            if (!Array.isArray(parsed)) {
                console.error('Response is not an array:'.red, parsed);
                return {error: 'TAG_PARSE_ERROR'};
            }

            const validTags: string[] = parsed.filter((tag: string) => tag.trim().length > 0 && tag.trim().length <= 20).map(tag => tag.trim());

            if (validTags.length === 0) {
                console.error('No valid tags found in response:'.red, parsed);
                return {error: 'NO_VALID_TAGS'};
            }

            return {
                tags: validTags.slice(0, 5),
                powered_by: modelName,
            };
        } catch (error: any) {
            console.error('Failed to parse tag generation response:'.red, error.message);
            return {error: 'TAG_PARSE_ERROR'};
        }
    }
}

export default TagGenerationService;
