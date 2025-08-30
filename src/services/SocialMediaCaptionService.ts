import "colors";
import AIService from "./AIService";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS} from "../utils/constants";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {
    AISocialMediaCaption,
    SOCIAL_MEDIA_CAPTION_STYLES,
    SOCIAL_MEDIA_PLATFORMS,
    SocialMediaCaptionParams,
    SocialMediaCaptionResponse,
    SocialMediaCaptionStyle,
    SocialMediaPlatform
} from "../types/ai";

class SocialMediaCaptionService {
    /**
     * Generate engaging social media captions for news article content using Gemini AI
     */
    static async generateCaption({content, url, platform, style}: SocialMediaCaptionParams): Promise<SocialMediaCaptionResponse> {
        console.log('Generating social media caption...'.cyan.italic, {platform, style});

        if (!content && !url) {
            console.error('Content and url both invalid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.error('Content and url both valid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        if (platform && !SOCIAL_MEDIA_PLATFORMS.includes(platform)) {
            console.error('Invalid platform:'.yellow.italic, platform);
            return {error: generateInvalidCode('platform')};
        }

        if (style && !SOCIAL_MEDIA_CAPTION_STYLES.includes(style)) {
            console.error('Invalid style:'.yellow.italic, style);
            return {error: generateInvalidCode('style')};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.info('Scraping URL for caption generation:'.cyan.italic, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.log('Empty content provided for caption generation'.yellow.italic);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 4000);

        for (let i = 0; i < AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS.length; i++) {
            const model = AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS[i];
            console.log(`Trying caption generation with model ${i + 1}/${AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS.length}:`.cyan, model);

            try {
                const result = await this.generateWithGemini(model, truncatedContent, platform, style);

                if (result.caption && result.caption.length > 0) {
                    console.log(`✅ Caption generation successful with model:`.green, model);
                    console.log('Generated caption:'.green, result.caption);
                    return result;
                }

                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, result.error);
            } catch (error: any) {
                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, error.message);
            }
        }

        console.error('🚨 All caption generation models failed'.red.bold);
        return {error: 'CAPTION_GENERATION_FAILED'};
    }

    /**
     * Generate social media caption using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string, platform?: SocialMediaPlatform, style?: SocialMediaCaptionStyle): Promise<SocialMediaCaptionResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
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
            console.log('Stripped markdown, clean JSON:'.yellow, responseText);
        }

        const parsed: AISocialMediaCaption = JSON.parse(responseText);

        if (!parsed.caption) {
            console.error('Invalid caption in response:'.red, parsed.caption);
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
