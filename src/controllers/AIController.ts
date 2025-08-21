import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {isListEmpty} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import AuthService from "../services/AuthService";
import StrikeService from "../services/StrikeService";
import {summarizeArticle} from "../services/AIService";
import {scrapeMultipleArticles} from "../services/NewsService";
import TagGenerationService from "../services/TagGenerationService";
import ComplexityMeterService from "../services/ComplexityMeterService";
import SentimentAnalysisService from "../services/SentimentAnalysisService";
import NewsClassificationService from "../services/NewsClassificationService";
import KeyPointsExtractionService from "../services/KeyPointsExtractionService";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ComplexityMeterParams, KeyPointsExtractionParams, SentimentAnalysisParams, SUMMARIZATION_STYLES, SummarizeArticleParams, TagGenerationParams} from "../types/ai";

const classifyContentController = async (req: Request, res: Response) => {
    console.info('classifyContentController called'.bgMagenta.white.italic);

    try {
        const {text, url} = req.body;

        if (!text && !url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'TEXT_OR_URL_REQUIRED',
                errorMsg: 'Either text or URL must be provided for classification',
            }));
            return;
        }

        if (text && url) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'TEXT_AND_URL_CONFLICT',
                errorMsg: 'Provide either text or URL, not both',
            }));
            return;
        }

        let contentToClassify = text;

        if (url && !text) {
            console.log('Scraping URL for classification:'.cyan.italic, url);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape the provided URL',
                }));
                return;
            }

            contentToClassify = scrapedArticles[0]?.content || '';
        }

        if (!contentToClassify || contentToClassify.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'EMPTY_CONTENT',
                errorMsg: 'No content available for classification',
            }));
            return;
        }

        const classification = await NewsClassificationService.classifyContent(contentToClassify);

        if (classification === 'error') {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'CLASSIFICATION_FAILED',
                errorMsg: 'Failed to classify content, try again after sometimes',
            }));
            return;
        }

        console.log('Content classified:'.cyan.italic, classification);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Content classified successfully 🎉',
            classification,
            isNews: classification === 'news',
            contentPreview: contentToClassify.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of classifyContentController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during classification',
        }));
    }
}

const summarizeArticleController = async (req: Request, res: Response) => {
    console.info('summarizeArticleController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, url, language, style}: SummarizeArticleParams = req.body;

        const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
        if (isBlocked) {
            res.status(403).send(new ApiResponse({
                success: false,
                errorCode: 'USER_BLOCKED',
                errorMsg: message,
                blockedUntil,
                blockType,
            }));
            return;
        }

        if (!content && !url) {
            console.error('Content and url both are missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided',
            }));
            return;
        }

        if (content && url) {
            console.error('Content and url both are present'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_AND_URL_CONFLICT',
                errorMsg: 'Provide either content or URL, not both',
            }));
            return;
        }

        if (style && !SUMMARIZATION_STYLES.includes(style)) {
            console.error('Invalid style:'.yellow.italic, style);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('style'),
                errorMsg: `Style must be one of: ${SUMMARIZATION_STYLES.join(', ')}`,
            }));
            return;
        }

        let articleContent = content || '';
        if (!content && url) {
            console.info('Scraping article content for classification check'.bgMagenta.white.italic);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape website',
                }));
                return;
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('content'),
                errorMsg: 'No content available for processing',
            }));
            return;
        }

        console.log('Checking if content is news-related...'.cyan.italic);
        const classification = await NewsClassificationService.classifyContent(articleContent);

        if (classification === 'error') {
            console.error('Classification failed, allowing request to proceed'.yellow.italic);
            // If classification fails, let the request continue (fail gracefully)
        } else if (classification === 'non_news') {
            console.log('Non-news content detected, applying strike...'.yellow.italic);
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike(email);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'NON_NEWS_CONTENT',
                errorMsg: message,
                strikeCount,
                isBlocked,
                blockedUntil,
            }));
            return;
        } else {
            console.log('News content verified, proceeding with summarization...'.green.italic);
        }

        const {summary, powered_by, error} = await summarizeArticle({email, content: articleContent, language, style});

        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'GEMINI_DAILY_LIMIT_REACHED') {
            console.error('gemini daily quota reached'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'GEMINI_DAILY_LIMIT_REACHED',
                errorMsg: 'Gemini\'s daily quota has been reached',
            }));
            return;
        }
        if (error === generateMissingCode('content') || error === 'SCRAPING_FAILED') {
            console.error('Failed to scrape:'.yellow.italic, error);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('content'),
                errorMsg: 'Failed to scrape website',
            }));
            return;
        }
        if (error === 'SUMMARIZATION_FAILED') {
            console.error('summarization failed'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'SUMMARIZATION_FAILED',
                errorMsg: 'Can\'t summarize at the moment, try again after sometimes',
            }));
            return;
        }

        console.log('article summarized:'.cyan.italic, {summary, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Article has been summarized 🎉',
            summary,
            powered_by,
            wasClassified: classification !== 'error' ? 'news' : 'classification_skipped',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of summarizeArticleController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const analyzeSentimentController = async (req: Request, res: Response) => {
    console.info('analyzeSentimentController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, url}: SentimentAnalysisParams = req.body;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

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

        let contentToAnalyze = content;

        if (!content && url) {
            console.log('Scraping URL for sentiment analysis:'.cyan.italic, url);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape the provided URL',
                }));
                return;
            }

            contentToAnalyze = scrapedArticles[0]?.content || '';
        }

        if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'EMPTY_CONTENT',
                errorMsg: 'No content available for sentiment analysis',
            }));
            return;
        }

        const {sentiment, confidence, error} = await SentimentAnalysisService.analyzeSentiment({content: contentToAnalyze});

        if (error) {
            let errorMsg = 'Failed to analyze sentiment';
            if (error === 'EMPTY_CONTENT') {
                errorMsg = 'No content provided for analysis';
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Sentiment analysis service is temporarily unavailable';
            } else if (error === 'SENTIMENT_ANALYSIS_FAILED') {
                errorMsg = 'Sentiment analysis failed, please try again';
            }

            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        const sentimentEmoji = SentimentAnalysisService.getSentimentEmoji(sentiment!);
        const sentimentColor = SentimentAnalysisService.getSentimentColor(sentiment!);

        console.log('sentiment analysis completed:'.cyan.italic, {sentiment, confidence, sentimentEmoji});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Sentiment analysis completed successfully 🎉',
            sentiment,
            confidence,
            sentimentEmoji,
            sentimentColor,
            contentPreview: contentToAnalyze.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of analyzeSentimentController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const generateTagsController = async (req: Request, res: Response) => {
    console.info('generateTagsController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, url}: TagGenerationParams = req.body;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

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

        const {tags, powered_by, error} = await TagGenerationService.generateTags({content, url});

        if (error) {
            let errorMsg = 'Failed to generate tags';
            let statusCode = 500;

            if (error === 'CONTENT_OR_URL_REQUIRED') {
                errorMsg = 'Either content or URL must be provided';
                statusCode = 400;
            } else if (error === 'CONTENT_AND_URL_CONFLICT') {
                errorMsg = 'Provide either content or URL, not both';
                statusCode = 400;
            } else if (error === 'SCRAPING_FAILED') {
                errorMsg = 'Failed to scrape the provided URL';
                statusCode = 400;
            } else if (error === 'EMPTY_CONTENT') {
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
            }));
            return;
        }

        console.log('Tags generated successfully:'.cyan.italic, {tags, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Tags generated successfully 🎉',
            tags,
            powered_by,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of generateTagsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during tag generation',
        }));
    }
}

const fetchKeyPointsController = async (req: Request, res: Response) => {
    console.info('fetchKeyPointsController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, url}: KeyPointsExtractionParams = req.body;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

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

        let contentToAnalyze = content;

        if (!content && url) {
            console.log('Scraping URL for key points extraction:'.cyan.italic, url);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape the provided URL',
                }));
                return;
            }

            contentToAnalyze = scrapedArticles[0]?.content || '';
        }

        if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'EMPTY_CONTENT',
                errorMsg: 'No content available for key points extraction',
            }));
            return;
        }

        const {keyPoints, error} = await KeyPointsExtractionService.extractKeyPoints({content: contentToAnalyze});

        if (error) {
            let errorMsg = 'Failed to extract key points';
            if (error === 'EMPTY_CONTENT') {
                errorMsg = 'No content provided for analysis';
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Key points extraction service is temporarily unavailable';
            } else if (error === 'KEY_POINTS_EXTRACTION_FAILED') {
                errorMsg = 'Key points extraction failed, please try again';
            } else if (error === 'KEY_POINTS_PARSE_ERROR') {
                errorMsg = 'Unable to parse extracted key points, please try again';
            } else if (error === 'NO_VALID_KEY_POINTS') {
                errorMsg = 'No valid key points found in the content';
            }

            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('Key points extraction completed:'.cyan.italic, keyPoints);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Key points extracted successfully 🎉',
            keyPoints,
            contentPreview: contentToAnalyze.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchKeyPointsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const fetchComplexityMeterController = async (req: Request, res: Response) => {
    console.info('fetchComplexityMeterController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, url}: ComplexityMeterParams = req.body;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

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

        let contentToAnalyze = content;

        if (!content && url) {
            console.log('Scraping URL for complexity analysis:'.cyan.italic, url);
            const scrapedArticles = await scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape the provided URL',
                }));
                return;
            }

            contentToAnalyze = scrapedArticles[0]?.content || '';
        }

        if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'EMPTY_CONTENT',
                errorMsg: 'No content available for complexity analysis',
            }));
            return;
        }

        const {complexityMeter, error} = await ComplexityMeterService.analyzeComplexity({content: contentToAnalyze});

        if (error) {
            let errorMsg = 'Failed to generate complexity meter';
            if (error === 'EMPTY_CONTENT') {
                errorMsg = 'No content provided for analysis';
            } else if (error === generateMissingCode('gemini_api_key')) {
                errorMsg = 'Complexity analysis service is temporarily unavailable';
            } else if (error === 'COMPLEXITY_METER_GENERATION_FAILED') {
                errorMsg = 'Complexity analysis failed, please try again';
            } else if (error === 'COMPLEXITY_PARSE_ERROR') {
                errorMsg = 'Unable to parse complexity analysis results, please try again';
            } else if (error === 'INVALID_COMPLEXITY_LEVEL') {
                errorMsg = 'Invalid complexity level received from analysis';
            }

            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('Complexity analysis completed:'.cyan.italic, complexityMeter);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Complexity meter generated successfully 🎉',
            complexityMeter,
            contentPreview: contentToAnalyze.substring(0, 200) + '...',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchComplexityMeterController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {classifyContentController, summarizeArticleController, analyzeSentimentController, generateTagsController, fetchKeyPointsController, fetchComplexityMeterController};
