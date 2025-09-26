import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import QuotaService from "./QuotaService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import NewsClassificationService from "./NewsClassificationService";
import {API_CONFIG, QUESTION_ANSWER_MODELS} from "../utils/constants";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {getCachedQuestionAnswer, getCachedQuestions, saveQuestionAnswer, saveQuestions} from "../utils/serviceHelpers/cacheHelpers";
import {IAIQuestionAnswering, IAIQuestionGeneration, IQuestionAnsweringParams, IQuestionAnsweringResponse, IQuestionGenerationParams, IQuestionGenerationResponse} from "../types/ai";

class QuestionAnswerService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate relevant questions for news article content using Gemini AI with caching
     */
    static async generateQuestions({email, content, url}: IQuestionGenerationParams): Promise<IQuestionGenerationResponse> {
        console.log('Service: QuestionAnswerService.generateQuestions called'.cyan.italic, {email, content, url});

        if (!url) {
            console.warn('Client Error: URL is invalid'.yellow, {content, url});
            return {error: generateMissingCode('url')};
        }

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

        let articleContent = content || '';
        const articleId = generateArticleId({url});
        if (!content && url) {
            console.log('External API: Scraping URL for question generation'.magenta, {url});
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
            console.log('News content verified, proceeding with question generation'.cyan);
        }

        const cached = await getCachedQuestions({articleId});
        if (cached && cached.questions.length > 0) {
            console.log('Questions retrieved from cache'.cyan, {articleId, questionsCount: cached.questions.length});
            return {questions: cached.questions, powered_by: 'Cached Result'};
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const fallbackResult = await QuotaService.executeWithModelFallback({
            primaryModel: QUESTION_ANSWER_MODELS[0],
            fallbackModels: QUESTION_ANSWER_MODELS.slice(1),
            executeAICall: (modelName: string) => this.generateQuestionsWithGemini(modelName, truncatedContent),
            count: 1,
        });

        if (!fallbackResult.success) {
            console.error('Service Error: All question generation models failed'.red.bold, {error: fallbackResult.error, attemptedModels: fallbackResult.attemptedModels});

            if (fallbackResult.error === 'QUOTA_EXHAUSTED') {
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            } else if (fallbackResult.error === 'ALL_AI_CALLS_FAILED') {
                return {error: 'QUESTION_GENERATION_FAILED'};
            } else {
                return {error: 'QUESTION_GENERATION_FAILED'};
            }
        }

        const result = fallbackResult.result!;
        const selectedModel = fallbackResult.selectedModel;

        if (result.questions && result.questions.length > 0) {
            console.log('Question generation completed successfully'.green.bold, {
                questions: result.questions,
                model: selectedModel,
                attemptedModels: fallbackResult.attemptedModels.length
            });

            await saveQuestions({articleId, url, questions: result.questions});

            return {...result, powered_by: selectedModel};
        }

        console.error('Service Error: Invalid question generation result'.red.bold, {model: selectedModel, error: result.error, result});
        return {error: 'QUESTION_GENERATION_FAILED'};
    }

    /**
     * Answer a specific question based on article content using Gemini AI with caching
     */
    static async answerQuestion({email, content, url, question}: IQuestionAnsweringParams): Promise<IQuestionAnsweringResponse> {
        console.log('Service: QuestionAnswerService.answerQuestion called'.cyan.italic, {email, content, url, question});

        if (!url) {
            console.warn('Client Error: URL is invalid'.yellow, {content, url});
            return {error: generateMissingCode('url')};
        }

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

        let articleContent = content || '';
        if (!content && url) {
            console.log('External API: Scraping URL for question answering'.magenta, {url});
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
            console.log('News content verified, proceeding with question answering'.cyan);
        }

        const articleId = generateArticleId({url});
        const cached = await getCachedQuestionAnswer({articleId, question});

        if (cached) {
            console.log('Answer retrieved from cache'.cyan, {articleId, question: question.substring(0, 50) + '...'});
            return {answer: cached.answer, powered_by: 'Cached Result'};
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const fallbackResult = await QuotaService.executeWithModelFallback({
            primaryModel: QUESTION_ANSWER_MODELS[0],
            fallbackModels: QUESTION_ANSWER_MODELS.slice(1),
            executeAICall: (modelName: string) => this.answerQuestionWithGemini(modelName, truncatedContent, question),
            count: 1,
        });

        if (!fallbackResult.success) {
            console.error('Service Error: All question answering models failed'.red.bold, {error: fallbackResult.error, attemptedModels: fallbackResult.attemptedModels});

            if (fallbackResult.error === 'QUOTA_EXHAUSTED') {
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            } else if (fallbackResult.error === 'ALL_AI_CALLS_FAILED') {
                return {error: 'QUESTION_ANSWERING_FAILED'};
            } else {
                return {error: 'QUESTION_ANSWERING_FAILED'};
            }
        }

        const result = fallbackResult.result!;
        const selectedModel = fallbackResult.selectedModel;

        if (result.answer && result.answer.trim().length > 0) {
            console.log('Question answering completed successfully'.green.bold, {
                answer: result.answer,
                model: selectedModel,
                attemptedModels: fallbackResult.attemptedModels.length
            });

            await saveQuestionAnswer({articleId, url, question, answer: result.answer});

            return {...result, powered_by: selectedModel};
        }

        console.error('Service Error: Invalid question answering result'.red.bold, {model: selectedModel, error: result.error, result});
        return {error: 'QUESTION_ANSWERING_FAILED'};
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
            throw new Error('QUESTION_PARSE_ERROR');
        }

        const validQuestions = parsed.questions.filter(q => q && q.trim().length > 0);

        if (validQuestions.length === 0) {
            console.error('Service Error: No valid questions found in response'.red.bold);
            throw new Error('NO_VALID_QUESTIONS');
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
            throw new Error('ANSWER_PARSE_ERROR');
        }

        return {answer: parsed.answer};
    }
}

export default QuestionAnswerService;
