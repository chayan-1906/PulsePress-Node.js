import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {isListEmpty} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import {processNaturalQuery, summarizeArticle} from "../services/AIService";
import {ParseQueryWithAIParams, SUMMARIZATION_STYLES, SummarizeArticleParams} from "../types/ai";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const summarizeArticleController = async (req: Request, res: Response) => {
    console.info('summarizeArticleController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, urls, language, style}: SummarizeArticleParams = req.body;

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

        const {summary, powered_by, error} = await summarizeArticle({email, content, urls, language, style});
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

// TODO: REMOVE
const parseQueryWithAIController = async (req: Request, res: Response) => {
    console.info('parseQueryWithAIController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {query}: Partial<ParseQueryWithAIParams> = req.query;

        if (!query) {
            console.error('Invalid query:'.yellow.italic, query);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('query'),
                errorMsg: 'Query is missing',
            }));
            return;
        }

        const {articles, totalResults, searchMetadata, error} = await processNaturalQuery({email, query});
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
        if (error === 'SMART_SEARCH_FAILED') {
            console.error('summarization failed'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'SMART_SEARCH_FAILED',
                errorMsg: 'Can\'t search at the moment, try again after sometimes',
            }));
            return;
        }
        console.log('AI parsed query:'.cyan.italic, {articles, totalResults, searchMetadata});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'AI has been parsed query 🎉',
            articles,
            totalResults,
            searchMetadata,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of parseQueryWithAIController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {summarizeArticleController, parseQueryWithAIController};
