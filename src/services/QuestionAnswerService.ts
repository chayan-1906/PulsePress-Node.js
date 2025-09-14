import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import QuotaService from "./QuotaService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import NewsClassificationService from "./NewsClassificationService";
import {API_CONFIG, QUESTION_ANSWER_MODELS} from "../utils/constants";
import {generateContentHash} from "../utils/serviceHelpers/contentHashing";
import CachedQuestionAnswerModel from "../models/CachedQuestionAnswerSchema";
import {cacheAnswer, cacheQuestions} from "../utils/serviceHelpers/cacheHelpers";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAIQuestionAnswering, IAIQuestionGeneration, IQuestionAnsweringParams, IQuestionAnsweringResponse, IQuestionGenerationParams, IQuestionGenerationResponse} from "../types/ai";

class QuestionAnswerService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate relevant questions for news article content using Gemini AI with caching
     */
    static async generateQuestions({email, content, url}: IQuestionGenerationParams): Promise<IQuestionGenerationResponse> {
        console.log('Service: QuestionAnswerService.generateQuestions called'.cyan.italic, {email, content, url});

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

        let articleContent = content || '';
        if (!content && url) {
            console.log('Scraping URL for question generation:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for question generation'.yellow);
            return {error: generateInvalidCode('content')};
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
            console.log('News content verified, proceeding with question generation'.bgGreen.bold);
        }

        const contentHash = generateContentHash(articleContent);

        // if (NODE_ENV === 'production') {
        try {
            const cachedResult = await CachedQuestionAnswerModel.findOne({contentHash});
            if (cachedResult && cachedResult.questions.length > 0) {
                console.log('Cache: Found cached questions'.green.bold, cachedResult.questions.length);
                return {questions: cachedResult.questions};
            }
        } catch (error) {
            console.warn('Service Warning: Cache lookup failed, proceeding with AI generation'.yellow, error);
        }
        // }
        console.log('Cache: No cached questions found for this article'.cyan);

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: QUESTION_ANSWER_MODELS[0],
            fallbackModels: QUESTION_ANSWER_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for question generation'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for question generation'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.generateQuestionsWithGemini(selectedModel, truncatedContent);

            if (result.questions && result.questions.length > 0) {
                console.log('Question generation completed successfully'.green.bold, {questions: result.questions, model: selectedModel});

                // if (NODE_ENV === 'production') {
                await cacheQuestions(contentHash, result.questions);
                // }

                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Question generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'QUESTION_GENERATION_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Question generation failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'QUESTION_GENERATION_FAILED'};
        }
    }

    /**
     * Answer a specific question based on article content using Gemini AI with caching
     */
    static async answerQuestion({email, content, url, question}: IQuestionAnsweringParams): Promise<IQuestionAnsweringResponse> {
        console.log('Service: QuestionAnswerService.answerQuestion called'.cyan.italic, {email, content, url, question});

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

        let articleContent = content || '';
        if (!content && url) {
            console.log('Scraping URL for question answering:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for question answering'.yellow);
            return {error: generateInvalidCode('content')};
        }

        if (!question || question.trim().length === 0) {
            console.warn('Client Error: Empty question provided for answering'.yellow);
            return {error: generateInvalidCode('question')};
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
            console.log('News content verified, proceeding with question answering'.bgGreen.bold);
        }

        const contentHash = generateContentHash(articleContent);

        // if (NODE_ENV === 'production') {
        try {
            const cachedResult = await CachedQuestionAnswerModel.findOne({contentHash});
            if (cachedResult && cachedResult.answers.has(question)) {
                const cachedAnswer = cachedResult.answers.get(question);
                console.log('Cache: Found cached answer for question:'.green.bold, question);
                return {answer: cachedAnswer};
            }
        } catch (error) {
            console.warn('Service Warning: Cache lookup failed, proceeding with AI generation'.yellow, error);
        }
        // }
        console.log('Cache: No cached answer found for this question'.cyan);

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: QUESTION_ANSWER_MODELS[0],
            fallbackModels: QUESTION_ANSWER_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for question answering'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for question answering'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.answerQuestionWithGemini(selectedModel, truncatedContent, question);

            if (result.answer && result.answer.trim().length > 0) {
                console.log('Question answering completed successfully'.green.bold, {answer: result.answer, model: selectedModel});

                await cacheAnswer(contentHash, question, result.answer);

                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Question answering failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'QUESTION_ANSWERING_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Question answering failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'QUESTION_ANSWERING_FAILED'};
        }
    }

    /**
     * Generate questions using Gemini AI
     */
    private static async generateQuestionsWithGemini(modelName: string, content: string): Promise<IQuestionGenerationResponse> {
        console.log('Service: QuestionAnswerService.generateQuestionsWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.QUESTION_GENERATION(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini question generation response:'.cyan, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAIQuestionGeneration = JSON.parse(responseText);

        if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            console.error('Service Error: Invalid questions array in response:'.red.bold, parsed.questions);
            return {error: 'QUESTION_PARSE_ERROR'};
        }

        const validQuestions = parsed.questions.filter(q => q && q.trim().length > 0);

        if (validQuestions.length === 0) {
            console.error('Service Error: No valid questions found in response'.red.bold);
            return {error: 'NO_VALID_QUESTIONS'};
        }

        return {questions: validQuestions};
    }

    /**
     * Answer question using Gemini AI
     */
    private static async answerQuestionWithGemini(modelName: string, content: string, question: string): Promise<IQuestionAnsweringResponse> {
        console.log('Service: QuestionAnswerService.answerQuestionWithGemini called'.cyan.italic, {modelName, content, question});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.QUESTION_ANSWERING(content, question);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini question answering response:'.cyan, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAIQuestionAnswering = JSON.parse(responseText);

        if (!parsed.answer || parsed.answer.trim().length === 0) {
            console.error('Service Error: Invalid answer in response:'.red.bold, parsed.answer);
            return {error: 'ANSWER_PARSE_ERROR'};
        }

        return {answer: parsed.answer};
    }

}

export default QuestionAnswerService;