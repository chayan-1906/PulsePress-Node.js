import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import AuthService from "../services/AuthService";
import NewsInsightsService from "../services/NewsInsightsService";
import TagGenerationService from "../services/TagGenerationService";
import SummarizationService from "../services/SummarizationService";
import QuestionAnswerService from "../services/QuestionAnswerService";
import ComplexityMeterService from "../services/ComplexityMeterService";
import SentimentAnalysisService from "../services/SentimentAnalysisService";
import SocialMediaCaptionService from "../services/SocialMediaCaptionService";
import NewsClassificationService from "../services/NewsClassificationService";
import KeyPointsExtractionService from "../services/KeyPointsExtractionService";
import GeographicExtractionService from "../services/GeographicExtractionService";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IComplexityMeterParams,
    IGeographicExtractionParams,
    IKeyPointsExtractionParams,
    INewsInsightsParams,
    IQuestionAnsweringParams,
    IQuestionGenerationParams,
    ISentimentAnalysisParams,
    ISocialMediaCaptionParams,
    ISummarizeArticleParams,
    ITagGenerationParams,
    SOCIAL_MEDIA_CAPTION_STYLES,
    SOCIAL_MEDIA_PLATFORMS,
    SUMMARIZATION_STYLES,
} from "../types/ai";

const classifyContentController = async (req: Request, res: Response) => {
    console.info('Controller: classifyContentController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {text, url} = req.body;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {classification, isNews, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await NewsClassificationService.classifyContentWithStrikeHandling({email, text, url});

        if (error) {
            let errorMsg = message || 'Failed to classify content';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'TEXT_OR_URL_REQUIRED') {
                errorMsg = 'Either text or URL must be provided for classification';
                statusCode = 400;
            } else if (error === 'TEXT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either text or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === 'CONTENT_REQUIRED') {
                errorMsg = 'Content is required for classification';
                statusCode = 400;
            } else if (error === 'CLASSIFICATION_FAILED') {
                errorMsg = 'Failed to classify content, try again after sometimes';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
                classification: classification || undefined,
                isNews: isNews || false,
            }));
            return;
        }

        console.log('News classified successfully:'.bgGreen.bold, {classification, isNews});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Content has been classified successfully 🎉',
            classification,
            isNews,
        }));
    } catch (error: any) {
        console.error('Controller Error: classifyContentController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during classification',
        }));
    }
}

const summarizeArticleController = async (req: Request, res: Response) => {
    console.info('Controller: summarizeArticleController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url, language, style}: ISummarizeArticleParams = req.body;

        if (!content && !url) {
            console.warn('Client Error: Missing content and URL parameters'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided',
            }));
            return;
        }

        if (content && url) {
            console.warn('Client Error: Both content and URL provided'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        if (style && !SUMMARIZATION_STYLES.includes(style)) {
            console.warn('Client Error: Invalid summarization style'.yellow, {style});
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('style'),
                errorMsg: `Style must be one of: ${SUMMARIZATION_STYLES.join(', ')}`,
            }));
            return;
        }

        const {summary, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await SummarizationService.summarizeArticle({email, content, url, language, style});

        if (error) {
            let errorMsg = message || 'Failed to summarize article';
            let statusCode = 500;

            if (error === 'USER_BLOCKED_FROM_AI_FEATURES') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'GEMINI_DAILY_LIMIT_REACHED') {
                errorMsg = 'Gemini\'s daily quota has been reached';
                statusCode = 400;
            } else if (error === generateMissingCode('content') || error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape website';
                statusCode = 400;
            } else if (error === 'SUMMARIZATION_FAILED') {
                errorMsg = 'Can\'t summarize at the moment, try again after sometimes';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Article summarization completed'.bgGreen.bold, {powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Article has been summarized 🎉',
            summary,
            powered_by,
        }));
    } catch (error: any) {
        console.error('Controller Error: summarizeArticleController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during article summarization',
        }));
    }
}

const generateTagsController = async (req: Request, res: Response) => {
    console.info('Controller: generateTagsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: ITagGenerationParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for tag generation',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {tags, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await TagGenerationService.generateTags({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to generate tags';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content available for tag generation';
                statusCode = 400;
            } else if (error === 'TAG_GENERATION_FAILED') {
                errorMsg = 'Tag generation failed, please try again';
                statusCode = 500;
            } else if (error === 'TAG_PARSE_ERROR' || error === 'NO_VALID_TAGS') {
                errorMsg = 'Unable to parse generated tags, please try again';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Tags generated successfully'.bgGreen.bold, {tagCount: tags?.length, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Tags have been generated successfully 🎉',
            tags,
            powered_by,
        }));
    } catch (error: any) {
        console.error('Controller Error: generateTagsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during tag generation',
        }));
    }
}

const analyzeSentimentController = async (req: Request, res: Response) => {
    console.info('Controller: analyzeSentimentController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: ISentimentAnalysisParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for sentiment analysis',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {sentiment, powered_by, confidence, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await SentimentAnalysisService.analyzeSentiment({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to analyze sentiment';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content provided for analysis';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Sentiment analysis service is temporarily unavailable';
                statusCode = 500;
            } else if (error === 'SENTIMENT_ANALYSIS_FAILED') {
                errorMsg = 'Sentiment analysis failed, please try again';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        const {getSentimentEmoji, getSentimentColor} = await import('../utils/serviceHelpers/sentimentHelpers');
        const sentimentEmoji = getSentimentEmoji(sentiment!);
        const sentimentColor = getSentimentColor(sentiment!);

        console.log('Sentiment analysis completed'.bgGreen.bold, {sentiment, confidence});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Sentiment analysis has been completed successfully 🎉',
            sentiment,
            confidence,
            sentimentEmoji,
            sentimentColor,
            powered_by,
            contentPreview: content?.substring(0, 200) + '...' || 'Content from URL',
        }));
    } catch (error: any) {
        console.error('Controller Error: analyzeSentimentController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during sentiment analysis',
        }));
    }
}

const extractKeyPointsController = async (req: Request, res: Response) => {
    console.info('Controller: extractKeyPointsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: IKeyPointsExtractionParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for key points extraction',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {keyPoints, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await KeyPointsExtractionService.extractKeyPoints({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to extract key points';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content provided for analysis';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Key points extraction service is temporarily unavailable';
            } else if (error === 'KEY_POINTS_EXTRACTION_FAILED') {
                errorMsg = 'Key points extraction failed, please try again';
            } else if (error === 'KEY_POINTS_PARSE_ERROR') {
                errorMsg = 'Unable to parse extracted key points, please try again';
            } else if (error === 'NO_VALID_KEY_POINTS') {
                errorMsg = 'No valid key points found in the content';
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Key points extraction completed'.bgGreen.bold, {keyPointsCount: keyPoints?.length});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Key points have been extracted successfully 🎉',
            keyPoints,
            powered_by,
            contentPreview: content?.substring(0, 200) + '...' || 'Content from URL',
        }));
    } catch (error: any) {
        console.error('Controller Error: extractKeyPointsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during key points extraction',
        }));
    }
}

const analyzeComplexityController = async (req: Request, res: Response) => {
    console.info('Controller: analyzeComplexityController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: IComplexityMeterParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for complexity analysis',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {complexityMeter, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await ComplexityMeterService.analyzeComplexity({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to generate complexity meter';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content provided for analysis';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Complexity analysis service is temporarily unavailable';
            } else if (error === 'COMPLEXITY_METER_GENERATION_FAILED') {
                errorMsg = 'Complexity analysis failed, please try again';
            } else if (error === 'COMPLEXITY_PARSE_ERROR') {
                errorMsg = 'Unable to parse complexity analysis results, please try again';
            } else if (error === 'INVALID_COMPLEXITY_LEVEL') {
                errorMsg = 'Invalid complexity level received from analysis';
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Complexity analysis completed'.bgGreen.bold, {level: complexityMeter?.level});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Complexity meter has been generated successfully 🎉',
            complexityMeter,
            powered_by,
            contentPreview: content?.substring(0, 200) + '...' || 'Content from URL',
        }));
    } catch (error: any) {
        console.error('Controller Error: analyzeComplexityController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during complexity analysis',
        }));
    }
}

const generateQuestionsController = async (req: Request, res: Response) => {
    console.info('Controller: generateQuestionsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content}: IQuestionGenerationParams = req.body;

        if (!content || content.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('content'),
                errorMsg: 'Content is required for question generation',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {questions, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await QuestionAnswerService.generateQuestions({email, content});

        if (error) {
            let errorMsg = message || 'Failed to generate questions';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateInvalidCode('content')) {
                errorMsg = 'No content provided for question generation';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Question generation service is temporarily unavailable';
                statusCode = 500;
            } else if (error === 'QUESTION_GENERATION_FAILED') {
                errorMsg = 'Question generation failed, please try again';
                statusCode = 500;
            } else if (error === 'QUESTION_PARSE_ERROR' || error === 'NO_VALID_QUESTIONS') {
                errorMsg = 'Unable to generate valid questions, please try again';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Questions generated successfully'.bgGreen.bold, {questionCount: questions?.length});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Questions have been generated successfully 🎉',
            questions,
            powered_by,
            contentPreview: content.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('Controller Error: generateQuestionsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during questions generation',
        }));
    }
}

const answerQuestionController = async (req: Request, res: Response) => {
    console.info('Controller: answerQuestionController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, question}: IQuestionAnsweringParams = req.body;

        if (!content || content.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('content'),
                errorMsg: 'Content is required for question answering',
            }));
            return;
        }

        if (!question || question.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('question'),
                errorMsg: 'Question is required for answering',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {answer, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await QuestionAnswerService.answerQuestion({email, content, question});

        if (error) {
            let errorMsg = message || 'Failed to answer question';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateInvalidCode('content')) {
                errorMsg = 'No content provided for question answering';
                statusCode = 400;
            } else if (error === generateInvalidCode('question')) {
                errorMsg = 'No question provided for answering';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Question answering service is temporarily unavailable';
                statusCode = 500;
            } else if (error === 'QUESTION_ANSWERING_FAILED') {
                errorMsg = 'Question answering failed, please try again';
                statusCode = 500;
            } else if (error === 'ANSWER_PARSE_ERROR') {
                errorMsg = 'Unable to generate a valid answer, please try again';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Question answered successfully'.bgGreen.bold, {question: question.substring(0, 50) + '...'});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Question has been answered successfully 🎉',
            question,
            answer,
            powered_by,
            contentPreview: content.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('Controller Error: answerQuestionController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong while answering question',
        }));
    }
}

const extractLocationsController = async (req: Request, res: Response) => {
    console.info('Controller: extractLocationsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: IGeographicExtractionParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for location extraction',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {locations, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await GeographicExtractionService.extractLocations({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to extract geographic locations';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content provided for analysis';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Geographic extraction service is temporarily unavailable';
            } else if (error === 'GEOGRAPHIC_EXTRACTION_FAILED') {
                errorMsg = 'Geographic extraction failed, please try again';
            } else if (error === 'GEOGRAPHIC_PARSE_ERROR') {
                errorMsg = 'Unable to parse extracted locations, please try again';
            } else if (error === 'NO_VALID_LOCATIONS') {
                errorMsg = 'No valid locations found in the content';
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Geographic locations extracted'.bgGreen.bold, {locationCount: locations?.length});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Geographic locations have been extracted successfully 🎉',
            locations,
            powered_by,
            contentPreview: content?.substring(0, 200) + '...' || 'Content from URL',
        }));
    } catch (error: any) {
        console.error('Controller Error: extractLocationsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during location extraction',
        }));
    }
}

const generateSocialMediaCaptionController = async (req: Request, res: Response) => {
    console.info('Controller: generateSocialMediaCaptionController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url, platform, style}: ISocialMediaCaptionParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for caption generation',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        if (platform && !SOCIAL_MEDIA_PLATFORMS.includes(platform)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('platform'),
                errorMsg: `Platform must be one of: ${SOCIAL_MEDIA_PLATFORMS.join(', ')}`,
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {caption, hashtags, characterCount, powered_by, error, message, strikeCount, isBlocked, blockedUntil, blockType} = await SocialMediaCaptionService.generateCaption({
            email,
            content,
            url,
            platform,
            style
        });

        if (error) {
            let errorMsg = message || 'Failed to generate social media caption';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content available for caption generation';
                statusCode = 400;
            } else if (error === generateInvalidCode('platform')) {
                errorMsg = `Invalid platform. Must be one of: ${SOCIAL_MEDIA_PLATFORMS.join(', ')}`;
                statusCode = 400;
            } else if (error === generateInvalidCode('style')) {
                errorMsg = `Invalid style provided. Must be one of: ${SOCIAL_MEDIA_CAPTION_STYLES.join(', ')}`;
                statusCode = 400;
            } else if (error === 'CAPTION_GENERATION_FAILED') {
                errorMsg = 'Caption generation failed, please try again';
                statusCode = 500;
            } else if (error === 'CAPTION_PARSE_ERROR') {
                errorMsg = 'Unable to parse generated caption, please try again';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
                strikeCount,
                isBlocked,
                blockedUntil,
                blockType,
            }));
            return;
        }

        console.log('Social media caption generated'.bgGreen.bold, {platform, style, characterCount, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Social media caption has been generated successfully 🎉',
            caption,
            hashtags,
            platform,
            style: style || 'engaging',
            characterCount,
            powered_by,
        }));
    } catch (error: any) {
        console.error('Controller Error: generateSocialMediaCaptionController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during caption generation',
        }));
    }
}

const generateNewsInsightsController = async (req: Request, res: Response) => {
    console.info('Controller: generateNewsInsightsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {content, url}: INewsInsightsParams = req.body;

        if (!content && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided for news insights analysis',
            }));
            return;
        }

        if (content && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        const {
            keyThemes,
            impactAssessment,
            contextConnections,
            stakeholderAnalysis,
            timelineContext,
            powered_by,
            error,
            message,
            strikeCount,
            isBlocked,
            blockedUntil,
            blockType
        } = await NewsInsightsService.generateInsights({email, content, url});

        if (error) {
            let errorMsg = message || 'Failed to generate news insights analysis';
            let statusCode = 500;

            if (error === 'USER_BLOCKED') {
                errorMsg = message || 'You are temporarily blocked from using AI features';
                statusCode = 403;
            } else if (error === 'NON_NEWS_CONTENT') {
                errorMsg = message || 'Non-news content detected';
                statusCode = 400;
            } else if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'No content provided for analysis';
                statusCode = 400;
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'News insights analysis service is temporarily unavailable';
                statusCode = 500;
            } else if (error === 'NEWS_INSIGHTS_ANALYSIS_FAILED') {
                errorMsg = 'News insights analysis failed, please try again';
                statusCode = 500;
            } else if (error === 'NEWS_INSIGHTS_PARSE_ERROR') {
                errorMsg = 'Unable to parse news insights analysis results, please try again';
                statusCode = 500;
            } else if (error === 'NO_VALID_THEMES') {
                errorMsg = 'No valid themes found in the content';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('News insights analysis completed'.bgGreen.bold, {themesCount: keyThemes?.length || 0, impactLevel: impactAssessment?.level, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'News insights analysis has been completed successfully 🎉',
            keyThemes,
            impactAssessment,
            contextConnections,
            stakeholderAnalysis,
            timelineContext,
            powered_by,
            contentPreview: content?.substring(0, 200) + '...' || 'Content from URL',
        }));
    } catch (error: any) {
        console.error('Controller Error: generateNewsInsightsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during news insights analysis',
        }));
    }
}

export {
    classifyContentController,
    summarizeArticleController,
    analyzeSentimentController,
    generateTagsController,
    extractKeyPointsController,
    analyzeComplexityController,
    generateQuestionsController,
    answerQuestionController,
    extractLocationsController,
    generateSocialMediaCaptionController,
    generateNewsInsightsController,
};
