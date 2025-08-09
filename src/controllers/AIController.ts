import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {isListEmpty} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import StrikeService from "../services/StrikeService";
import {summarizeArticle} from "../services/AIService";
import {scrapeMultipleArticles} from "../services/NewsService";
import {SUMMARIZATION_STYLES, SummarizeArticleParams} from "../types/ai";
import NewsClassificationService from "../services/NewsClassificationService";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

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
        const {content, urls, language, style}: SummarizeArticleParams = req.body;

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

        if (!content && isListEmpty(urls)) {
            console.error('Content and urls both are missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CONTENT_OR_URL_REQUIRED',
                errorMsg: 'Either content or URL must be provided',
            }));
            return;
        }

        if (content && !isListEmpty(urls)) {
            console.error('Content and urls both are present'.yellow.italic);
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
        if (!content && !isListEmpty(urls)) {
            console.info('Scraping article content for classification check'.bgMagenta.white.italic);
            const scrapedArticles = await scrapeMultipleArticles({urls});

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

        const {summary, powered_by, error} = await summarizeArticle({email, content: articleContent, urls: undefined, language, style});

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

export {classifyContentController, summarizeArticleController};
