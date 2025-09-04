import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY, NODE_ENV} from "../config/config";
import {QUESTION_ANSWER_MODELS} from "../utils/constants";
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
    static async generateQuestions({content}: IQuestionGenerationParams): Promise<IQuestionGenerationResponse> {
        console.log('Service: QuestionAnswerService.generateQuestions called'.cyan.italic, {content});

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for question generation'.yellow);
            return {error: generateInvalidCode('content')};
        }

        const contentHash = generateContentHash(content);

        if (NODE_ENV === 'production') {
            try {
                const cachedResult = await CachedQuestionAnswerModel.findOne({contentHash});
                if (cachedResult && cachedResult.questions.length > 0) {
                    console.log('Cache: Found cached questions'.green.bold, cachedResult.questions.length);
                    return {questions: cachedResult.questions};
                }
            } catch (error) {
                console.warn('Service Warning: Cache lookup failed, proceeding with AI generation'.yellow, error);
            }
        }
        console.log('Cache: No cached questions found for this article'.cyan);

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(content, 4000);

        for (let i = 0; i < QUESTION_ANSWER_MODELS.length; i++) {
            const modelName = QUESTION_ANSWER_MODELS[i];
            console.log(`Trying question generation with model ${i + 1}/${QUESTION_ANSWER_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.generateQuestionsWithGemini(modelName, truncatedContent);

                if (result.questions && result.questions.length > 0) {
                    console.log(`Question generation successful with model:`.cyan, modelName);
                    console.log('Generated questions:'.green.bold, result.questions);

                    if (NODE_ENV === 'production') {
                        await cacheQuestions(contentHash, result.questions);
                    }

                    return {...result, powered_by: modelName};
                }

                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', error.message);
            }
        }

        console.error('Service Error: All question generation models failed'.red.bold);
        return {error: 'QUESTION_GENERATION_FAILED'};
    }

    /**
     * Answer a specific question based on article content using Gemini AI with caching
     */
    static async answerQuestion({content, question}: IQuestionAnsweringParams): Promise<IQuestionAnsweringResponse> {
        console.log('Service: QuestionAnswerService.answerQuestion called'.cyan.italic, {content, question});

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for question answering'.yellow);
            return {error: generateInvalidCode('content')};
        }

        if (!question || question.trim().length === 0) {
            console.warn('Client Error: Empty question provided for answering'.yellow);
            return {error: generateInvalidCode('question')};
        }

        const contentHash = generateContentHash(content);

        if (NODE_ENV === 'production') {
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
        }
        console.log('Cache: No cached answer found for this question'.cyan);

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(content, 4000);

        for (let i = 0; i < QUESTION_ANSWER_MODELS.length; i++) {
            const modelName = QUESTION_ANSWER_MODELS[i];
            console.log(`Trying question answering with model ${i + 1}/${QUESTION_ANSWER_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.answerQuestionWithGemini(modelName, truncatedContent, question);

                if (result.answer && result.answer.trim().length > 0) {
                    console.log(`Question answering successful with model:`.cyan, modelName);
                    console.log('Generated answer:'.green.bold, result.answer);

                    await cacheAnswer(contentHash, question, result.answer);

                    return {...result, powered_by: modelName};
                }

                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, modelName, 'Error:', error.message);
            }
        }

        console.error('Service Error: All question answering models failed'.red.bold);
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
