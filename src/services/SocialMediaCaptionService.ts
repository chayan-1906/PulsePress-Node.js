import "colors";
import AIService from "./AIService";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS} from "../utils/constants";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {
    IAISocialMediaCaption,
    SOCIAL_MEDIA_CAPTION_STYLES,
    SOCIAL_MEDIA_PLATFORMS,
    ISocialMediaCaptionParams,
    ISocialMediaCaptionResponse,
    TSocialMediaCaptionStyle,
    TSocialMediaPlatform
} from "../types/ai";

class SocialMediaCaptionService {
    /**
     * Generate engaging social media captions for news article content using Gemini AI
     */
    static async generateCaption({content, url, platform, style}: ISocialMediaCaptionParams): Promise<ISocialMediaCaptionResponse> {
        console.log('Service: SocialMediaCaptionService.generateCaption called'.cyan.italic, {content, url, platform, style});

        if (!content && !url) {
            console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Content and url both valid'.yellow, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        if (platform && !SOCIAL_MEDIA_PLATFORMS.includes(platform)) {
            console.warn('Client Error: Invalid platform'.yellow, platform);
            return {error: generateInvalidCode('platform')};
        }

        if (style && !SOCIAL_MEDIA_CAPTION_STYLES.includes(style)) {
            console.warn('Client Error: Invalid style'.yellow, style);
            return {error: generateInvalidCode('style')};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.log('Scraping URL for caption generation:'.cyan, url);
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

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 4000);

        for (let i = 0; i < AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS.length; i++) {
            const modelName = AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS[i];
            console.log(`Trying caption generation with model ${i + 1}/${AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.generateWithGemini(modelName, truncatedContent, platform, style);

                if (result.caption && result.caption.length > 0) {
                    console.log(`Caption generation successful with model:`.cyan, modelName);
                    console.log('Social media caption generation completed successfully'.green.bold, {caption: result.caption, model: modelName});
                    return {...result, powered_by: modelName};
                }

                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', error.message);
            }
        }

        console.error('Service Error: All caption generation models failed'.red.bold);
        return {error: 'CAPTION_GENERATION_FAILED'};
    }

    /**
     * Generate social media caption using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string, platform?: TSocialMediaPlatform, style?: TSocialMediaCaptionStyle): Promise<ISocialMediaCaptionResponse> {
        console.log('Service: SentimentAnalysisService.generateWithGemini called'.cyan.italic, {modelName, content, platform, style});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.SOCIAL_MEDIA_CAPTION(content, platform || 'twitter', style || 'engaging');

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini caption generation response:'.cyan, responseText);

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
            console.log('Stripped markdown, clean JSON:'.cyan, responseText);
        }

        const parsed: IAISocialMediaCaption = JSON.parse(responseText);

        if (!parsed.caption) {
            console.error('Service Error: Invalid caption in response:'.red.bold, parsed.caption);
            return {error: 'CAPTION_PARSE_ERROR'};
        }

        let hashtags = parsed.hashtags || [];
        if (!Array.isArray(hashtags) || hashtags.length === 0) {
            const hashtagMatches = parsed.caption.match(/#\w+/g);
            if (hashtagMatches) {
                hashtags = hashtagMatches;
            } else {
                hashtags = [];
            }
        }

        const characterCount = parsed.caption.length;

        return {
            caption: parsed.caption,
            hashtags,
            platform,
            style,
            characterCount,
            powered_by: modelName,
        };
    }
}

export default SocialMediaCaptionService;
