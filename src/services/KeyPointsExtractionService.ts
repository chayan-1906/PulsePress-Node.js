import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_KEY_POINTS_EXTRACTOR_MODELS, API_CONFIG} from "../utils/constants";
import {IAIKeyPoints, IKeyPointsExtractionParams, IKeyPointsExtractionResponse} from "../types/ai";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";

class KeyPointsExtractionService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Extracts key points from news article content using Gemini AI
     */
    static async extractKeyPoints({email, content, url}: IKeyPointsExtractionParams): Promise<IKeyPointsExtractionResponse> {
        console.log('Service: KeyPointsExtractionService.extractKeyPoints called'.cyan.italic, {email, content, url});

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
            console.log('Scraping URL for key points extraction:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for key points extraction'.yellow);
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
            console.log('News content verified, proceeding with key points extraction'.bgGreen.bold);
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        for (let i = 0; i < AI_KEY_POINTS_EXTRACTOR_MODELS.length; i++) {
            const modelName = AI_KEY_POINTS_EXTRACTOR_MODELS[i];
            console.log(`Trying key points extraction with model ${i + 1}/${AI_KEY_POINTS_EXTRACTOR_MODELS.length}:`.cyan, modelName);

            try {
                let result: IKeyPointsExtractionResponse;
                result = await this.extractWithGemini(modelName, truncatedContent);

                if (result.keyPoints && result.keyPoints.length > 0) {
                    console.log(`✅ Key points extraction successful with model:`.cyan, modelName);
                    console.log('Key points extraction result:'.cyan, result.keyPoints);
                    console.log('Key points extraction completed successfully'.green.bold);
                    return {...result, powered_by: modelName};
                }

                console.error('Service Error: Key points extraction model failed'.red.bold, {model: modelName, error: result.error});
            } catch (error: any) {
                console.error('Service Error: Key points extraction model failed'.red.bold, {model: modelName, error: error.message});
            }
        }

        console.error('Service Error: All key points extraction models failed'.red.bold);
        return {error: 'KEY_POINTS_EXTRACTION_FAILED'};
    }

    /**
     * Extract key points using Gemini AI
     */
    private static async extractWithGemini(modelName: string, content: string): Promise<IKeyPointsExtractionResponse> {
        console.log('Service: KeyPointsExtractionService.extractWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating key points extraction with Gemini'.magenta, {model: modelName});
        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.KEY_POINTS_EXTRACTION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAIKeyPoints = JSON.parse(responseText);

        if (!parsed.keyPoints || !Array.isArray(parsed.keyPoints) || parsed.keyPoints.length === 0) {
            console.error('Service Error: Invalid key points array in response'.red.bold, parsed.keyPoints);
            return {error: 'KEY_POINTS_PARSE_ERROR'};
        }

        console.log('Key points parsed successfully'.cyan, parsed.keyPoints);
        return {keyPoints: parsed.keyPoints};
    }
}

export default KeyPointsExtractionService;
