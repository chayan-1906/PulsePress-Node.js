import "colors";
import axios from "axios";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {buildHeader} from "../utils/buildHeader";
import {AI_SUMMARIZATION_MODELS, API_CONFIG} from "../utils/constants";
import {GEMINI_API_KEY, HUGGINGFACE_API_TOKEN} from "../config/config";
import {truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {processHuggingFaceResponse} from "../utils/serviceHelpers/externalApiHelpers";
import {IAIClassification, INewsClassificationParams, INewsClassificationResponse, TClassificationResult} from "../types/ai";

class NewsClassificationService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    static readonly huggingFaceUrl = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';

    /**
     * Classification with strike handling and user blocking
     */
    static async classifyContentWithStrikeHandling({email, text, url}: INewsClassificationParams): Promise<INewsClassificationResponse> {
        console.log('Service: NewsClassificationService.classifyContentWithStrikeHandling called'.cyan.italic, {email, text, url});

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

        if (!text && !url) {
            console.warn('Client Error: Text and url both invalid'.yellow, {text, url});
            return {error: 'TEXT_OR_URL_REQUIRED'};
        }

        if (text && url) {
            console.warn('Client Error: Text and url both valid'.yellow, {text, url});
            return {error: 'TEXT_AND_URL_CONFLICT'};
        }

        let contentToClassify = text || '';
        if (!text && url) {
            console.log('External API: Scraping URL for classification'.magenta, {url});
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            contentToClassify = scrapedArticles[0]?.content || '';
        }

        if (!contentToClassify || contentToClassify.trim().length === 0) {
            console.warn('Client Error: Empty content provided for classification'.yellow);
            return {error: 'CONTENT_REQUIRED'};
        }

        const classification = await this.classifyContent(contentToClassify);

        if (classification === 'error') {
            console.error('Service Error: Classification failed'.red.bold);
            return {error: 'CLASSIFICATION_FAILED'};
        } else if (classification === 'non_news') {
            console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike(email, 'search_query', contentToClassify);
            return {error: 'NON_NEWS_CONTENT', classification, isNews: false, message, strikeCount, isBlocked, blockedUntil};
        }

        console.log('News classified successfully'.bgGreen.bold, {classification, isNews: classification === 'news'});
        return {classification, isNews: classification === 'news'};
    }

    /**
     * Main classification method with HuggingFace -> Gemini fallback (utility method)
     */
    static async classifyContent(text: string): Promise<TClassificationResult> {
        console.log('Service: NewsClassificationService.classifyContent called'.cyan.italic, {textLength: text?.length});

        if (!text || text.trim().length === 0) {
            console.warn('Client Error: Empty text provided for classification'.yellow);
            return 'error';
        }

        try {
            const result = await this.classifyWithHuggingFace(text);
            console.log('Classification with HuggingFace successful'.cyan, result);
            console.log('Content classification completed successfully'.green.bold);
            return result;
        } catch (error: any) {
            console.warn('External API: HuggingFace classification failed, trying Gemini fallback'.yellow, error.message);

            try {
                const result = await this.classifyWithGemini(text);
                console.log('Classification with Gemini successful'.cyan, result);
                console.log('Content classification completed successfully'.green.bold);
                return result;
            } catch (geminiError: any) {
                console.error('Service Error: Both HuggingFace and Gemini classification failed'.red.bold, geminiError.message);
                return 'error';
            }
        }
    }

    /**
     * HuggingFace BART-based classification using zero-shot classification
     */
    private static async classifyWithHuggingFace(text: string): Promise<TClassificationResult> {
        console.log('Service: NewsClassificationService.classifyWithHuggingFace called'.cyan.italic, {text});

        if (!HUGGINGFACE_API_TOKEN) {
            console.warn('Config Warning: HuggingFace API token not configured'.yellow.italic);
            throw new Error('HuggingFace API token not configured');
        }

        // Truncate text for HuggingFace
        const truncatedText = truncateContentForAI(text, 2000);

        const payload = {
            inputs: truncatedText,
            parameters: {
                candidate_labels: [
                    'current news and breaking news content',
                    'educational content and tutorials',
                    'personal notifications and emails',
                    'advertisements and promotional content',
                ],
            },
        };

        console.log('External API: Calling HuggingFace classification API'.magenta);
        const response = await axios.post(
            this.huggingFaceUrl,
            payload,
            {
                headers: buildHeader('huggingface'),
                timeout: 10000,
            },
        );

        const result = response.data;
        return processHuggingFaceResponse(result);
    }

    /**
     * Gemini-based classification fallback with enhanced prompting
     */
    private static async classifyWithGemini(text: string): Promise<TClassificationResult> {
        console.log('Service: NewsClassificationService.classifyWithGemini called'.cyan.italic, {text});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            throw new Error('Gemini API key not configured');
        }

        // Truncate text for Gemini
        const truncatedText = truncateContentForAI(text, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        console.log('External API: Generating classification with Gemini'.magenta, {model: AI_SUMMARIZATION_MODELS[0]});
        const model = this.genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});

        const prompt = AI_PROMPTS.NEWS_CLASSIFICATION(truncatedText);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        try {
            const parsed: IAIClassification = JSON.parse(responseText);
            if (parsed.classification === 'news' || parsed.classification === 'non_news') {
                console.log('Gemini JSON response parsed successfully'.cyan, parsed.classification);
                return parsed.classification;
            }
        } catch (error) {
            console.warn('Service Warning: Failed to parse JSON response from Gemini'.yellow, error);
        }

        // Fallback parsing for non-JSON responses
        console.log('Using fallback text parsing for Gemini response'.cyan);
        const lowerText = responseText.toLowerCase();
        if (lowerText.includes('news') && !lowerText.includes('non_news')) {
            return 'news';
        } else if (lowerText.includes('non_news')) {
            return 'non_news';
        } else {
            console.warn('Service Warning: Unexpected Gemini response format'.yellow, responseText);
            console.warn('Service Warning: Using fallback - assuming news for unclear cases'.yellow);
            return 'news';
        }
    }
}

export default NewsClassificationService;
