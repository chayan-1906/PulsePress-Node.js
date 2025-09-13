import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_TAG_GENERATION_MODELS, API_CONFIG} from "../utils/constants";
import {ITagGenerationParams, ITagGenerationResponse} from "../types/ai";
import {validateAndProcessTags} from "../utils/serviceHelpers/tagHelpers";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";

class TagGenerationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate relevant tags for news article content using Gemini AI
     */
    static async generateTags({email, content, url}: ITagGenerationParams): Promise<ITagGenerationResponse> {
        console.log('Service: TagGenerationService.generateTags called'.cyan.italic, {email, content, url});

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
            console.warn('Client Error: Empty content provided for tag generation'.yellow);
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
            console.log('News content verified, proceeding with tag generation'.bgGreen.bold);
        }

        // Truncate content to avoid token limits - use title and description primarily
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

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
