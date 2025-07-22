import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {CompleteArticleParams, GetReadingHistoryParams, ModifyReadingHistoryParams} from "../types/reading-history";
import {clearHistory, completeArticle, getReadingAnalytics, getReadingHistories, modifyReadingHistory} from "../services/ReadingHistoryService";

const modifyReadingHistoryController = async (req: Request, res: Response) => {
    console.log('modifyReadingHistoryController called');
    try {
        const email = (req as AuthRequest).email;
        const {articleUrl, readAt, readDuration, completed}: ModifyReadingHistoryParams = req.body;
        if (!articleUrl) {
            console.error('Article URL is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }
        if (!readAt) {
            console.error('ReadAt is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('readAt'),
                errorMsg: 'ReadAt is missing',
            }));
            return;
        }
        if (completed === null || typeof completed === 'undefined') {
            console.error('Completed is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('completed'),
                errorMsg: 'Completed is missing',
            }));
            return;
        }

        const {isModified, error} = await modifyReadingHistory({email, articleUrl, readAt, readDuration, completed});
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

        if (isModified) {
            res.status(200).send(new ApiResponse({
                success: true,
                message: 'Reading history modified 🎉',
                isModified,
            }));
        } else {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'MODIFY_HISTORY_FAILED',
                errorMsg: 'Failed to modify history of article',
                isModified,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of modifyReadingHistoryController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getReadingHistoriesController = async (req: Request, res: Response) => {
    console.log('getReadingHistoryController called');
    try {
        const email = (req as AuthRequest).email;
        const {pageSize, page}: Partial<GetReadingHistoryParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {readingHistories, totalCount, currentPage, totalPages, error} = await getReadingHistories({email, pageSize: pageSizeNumber, page: pageNumber});
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

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Reading histories fetched 🎉',
            readingHistories,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getReadingHistoriesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const completeArticleController = async (req: Request, res: Response) => {
    console.log('completeArticleController called');
    try {
        const email = (req as AuthRequest).email;
        const {articleUrl}: CompleteArticleParams = req.body;
        if (!articleUrl) {
            console.error('Article URL is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }

        const {isCompleted, error} = await completeArticle({email, articleUrl});
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
        if (error === 'ARTICLE_NOT_IN_HISTORY') {
            console.error('Email is missing'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: 'ARTICLE_NOT_IN_HISTORY',
                errorMsg: 'Article is not present in reading history',
            }));
            return;
        }
        if (!isCompleted) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'COMPLETE_ARTICLE_FAILED',
                errorMsg: 'Failed to mark article as completed',
                isCompleted,
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Article marked as completed 🎉',
            isCompleted,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of completeArticleController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const clearHistoryController = async (req: Request, res: Response) => {
    console.log('clearHistoryController called');
    try {
        const email = (req as AuthRequest).email;

        const {isCleared, error} = await clearHistory({email});
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

        if (isCleared) {
            res.status(200).send(new ApiResponse({
                success: true,
                message: 'Reading history cleared 🎉',
            }));
        } else {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'CLEAR_HISTORY_FAILED',
                errorMsg: 'Failed to clear reading history',
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of clearHistoryController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getReadingHistoryAnalyticsController = async (req: Request, res: Response) => {
    console.log('getReadingHistoryAnalyticsController called');
    try {
        const email = (req as AuthRequest).email;

        const {analytics, error} = await getReadingAnalytics({email});
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
        if (error) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_ANALYTICS_FAILED',
                errorMsg: 'Failed to get reading history analytics',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Reading history analytics fetched 🎉',
            analytics,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getReadingHistoryAnalyticsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

export {modifyReadingHistoryController, getReadingHistoriesController, completeArticleController, clearHistoryController, getReadingHistoryAnalyticsController};
