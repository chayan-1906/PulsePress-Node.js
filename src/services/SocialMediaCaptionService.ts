import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import QuotaService from "./QuotaService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import NewsClassificationService from "./NewsClassificationService";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {
    IAISocialMediaCaption,
    ISocialMediaCaptionParams,
    ISocialMediaCaptionResponse,
    SOCIAL_MEDIA_CAPTION_STYLES,
    SOCIAL_MEDIA_PLATFORMS,
    TSocialMediaCaptionStyle,
    TSocialMediaPlatform
} from "../types/ai";

class SocialMediaCaptionService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate engaging social media captions for news article content using Gemini AI
     */
    static async generateCaption({email, content, url, platform, style}: ISocialMediaCaptionParams): Promise<ISocialMediaCaptionResponse> {
        console.log('Service: SocialMediaCaptionService.generateCaption called'.cyan.italic, {email, content, url, platform, style});

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

        console.log('External API: Validating news content classification'.magenta);
        const classification = await NewsClassificationService.classifyContent(articleContent);

        if (classification === 'error') {
            console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
        } else if (classification === 'non_news') {
            console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike({email, violationType: 'ai_enhancement', content: articleContent});
            return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
        } else {
            console.log('News content verified, proceeding with caption generation'.bgGreen.bold);
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS[0],
            fallbackModels: AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for social media caption generation'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for social media caption generation'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.generateWithGemini(selectedModel, truncatedContent, platform, style);

            if (result.caption && result.caption.length > 0) {
                console.log('Social media caption generation completed successfully'.green.bold, {caption: result.caption, model: selectedModel});
                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Social media caption generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'CAPTION_GENERATION_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Social media caption generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'CAPTION_GENERATION_FAILED'};
        }
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

        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.SOCIAL_MEDIA_CAPTION(content, platform || 'twitter', style || 'engaging');

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini caption generation response:'.cyan, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

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
