import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import ReadingHistoryService from "../services/ReadingHistoryService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {CompleteArticleParams, DeleteReadingHistoryParams, GetReadingHistoryParams, ModifyReadingHistoryParams, SearchReadingHistoryParams} from "../types/reading-history";

const modifyReadingHistoryController = async (req: Request, res: Response) => {
    console.log('modifyReadingHistoryController called');

    try {
        const email = (req as AuthRequest).email;
        const {title, articleUrl, source, description, readAt, readDuration, completed, publishedAt}: ModifyReadingHistoryParams = req.body;
        if (!title) {
            console.error('Title is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('title'),
                errorMsg: 'Title is missing',
            }));
            return;
        }
        if (!articleUrl) {
            console.error('Article URL is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }
        if (!source) {
            console.error('Source is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('source'),
                errorMsg: 'Source is missing',
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
        if (!publishedAt) {
            console.error('PublishedAt is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('published_at'),
                errorMsg: 'Published date is missing',
            }));
            return;
        }

        const {isModified, error} = await ReadingHistoryService.modifyReadingHistory({email, title, articleUrl, source, description, readAt, readDuration, completed, publishedAt});
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
                message: 'Reading history has been modified 🎉',
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

        const {readingHistories, totalCount, currentPage, totalPages, error} = await ReadingHistoryService.getReadingHistories({email, pageSize: pageSizeNumber, page: pageNumber});
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
            message: 'Reading histories have been fetched 🎉',
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

        const {isCompleted, error} = await ReadingHistoryService.completeArticle({email, articleUrl});
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
            message: 'Article has been marked as completed 🎉',
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

const clearReadingHistoryController = async (req: Request, res: Response) => {
    console.log('clearReadingHistoryController called');

    try {
        const email = (req as AuthRequest).email;

        const {isCleared, error} = await ReadingHistoryService.clearReadingHistories({email});
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
                message: 'Reading history has been cleared 🎉',
            }));
        } else {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'CLEAR_HISTORY_FAILED',
                errorMsg: 'Failed to clear reading history',
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of clearReadingHistoryController:'.red.bold, error);
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

        const {analytics, error} = await ReadingHistoryService.getReadingAnalytics({email});
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
            message: 'Reading history analytics have been fetched 🎉',
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

const searchReadingHistoriesController = async (req: Request, res: Response) => {
    console.info('searchReadingHistoriesController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {q, sources, sortBy, sortOrder, pageSize, page}: Partial<SearchReadingHistoryParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {readingHistories, totalCount, currentPage, totalPages, error} = await ReadingHistoryService.searchReadingHistories({
            email,
            q,
            sources,
            sortBy,
            sortOrder,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
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
        console.log('searched articles count:'.cyan.italic, totalCount);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Search results have been found 🎉',
            searchResults: readingHistories,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of searchReadingHistoriesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const deleteReadingHistoryController = async (req: Request, res: Response) => {
    console.log('deleteReadingHistoryController called');

    try {
        const email = (req as AuthRequest).email;
        const {readingHistoryExternalId}: DeleteReadingHistoryParams = req.body;

        if (!readingHistoryExternalId) {
            console.error('Reading history external ID is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('reading_history_external_id'),
                errorMsg: 'Reading history external ID is missing',
            }));
            return;
        }

        const {isDeleted, error} = await ReadingHistoryService.deleteReadingHistory({email, readingHistoryExternalId});
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
        if (error === generateNotFoundCode('reading_history')) {
            console.error('Reading history not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('reading_history'),
                errorMsg: 'Reading history not found',
            }));
            return;
        }

        if (isDeleted) {
            res.status(200).send(new ApiResponse({
                success: true,
                message: 'Reading history has been deleted 🎉',
            }));
        } else {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'DELETE_HISTORY_FAILED',
                errorMsg: 'Failed to delete reading history',
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of deleteReadingHistoryController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

export {
    modifyReadingHistoryController,
    getReadingHistoriesController,
    completeArticleController,
    clearReadingHistoryController,
    getReadingHistoryAnalyticsController,
    searchReadingHistoriesController,
    deleteReadingHistoryController,
};
