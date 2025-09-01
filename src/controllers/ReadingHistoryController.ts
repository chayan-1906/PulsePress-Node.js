import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import ReadingHistoryService from "../services/ReadingHistoryService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ICompleteArticleParams, IDeleteReadingHistoryParams, IGetReadingHistoryParams, IModifyReadingHistoryParams, ISearchReadingHistoryParams} from "../types/reading-history";

const modifyReadingHistoryController = async (req: Request, res: Response) => {
    console.info('Controller: modifyReadingHistoryController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {title, articleUrl, source, description, readAt, readDuration, completed, publishedAt}: IModifyReadingHistoryParams = req.body;
        if (!title) {
            console.warn('Client Error: Missing title parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('title'),
                errorMsg: 'Title is missing',
            }));
            return;
        }
        if (!articleUrl) {
            console.warn('Client Error: Missing article URL parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }
        if (!source) {
            console.warn('Client Error: Missing source parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('source'),
                errorMsg: 'Source is missing',
            }));
            return;
        }
        if (!readAt) {
            console.warn('Client Error: Missing readAt parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('readAt'),
                errorMsg: 'ReadAt is missing',
            }));
            return;
        }
        if (completed === null || typeof completed === 'undefined') {
            console.warn('Client Error: Missing completed parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('completed'),
                errorMsg: 'Completed is missing',
            }));
            return;
        }
        if (!publishedAt) {
            console.warn('Client Error: Missing publishedAt parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('published_at'),
                errorMsg: 'Published date is missing',
            }));
            return;
        }

        const {isModified, error} = await ReadingHistoryService.modifyReadingHistory({email, title, articleUrl, source, description, readAt, readDuration, completed, publishedAt});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        if (isModified) {
            console.log('SUCCESS: Reading history modified'.bgGreen.bold, {articleUrl});
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
        console.error('Controller Error: modifyReadingHistoryController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during reading history modifications',
        }));
    }
}

const getReadingHistoriesController = async (req: Request, res: Response) => {
    console.info('Controller: getReadingHistoriesController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {pageSize, page}: Partial<IGetReadingHistoryParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {readingHistories, totalCount, currentPage, totalPages, error} = await ReadingHistoryService.getReadingHistories({email, pageSize: pageSizeNumber, page: pageNumber});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        console.log('SUCCESS: Reading histories fetched'.bgGreen.bold, {totalCount});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Reading histories have been fetched 🎉',
            readingHistories,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('Controller Error: getReadingHistoriesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while retrieving reading history',
        }));
    }
}

const completeArticleController = async (req: Request, res: Response) => {
    console.info('Controller: completeArticleController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {articleUrl}: ICompleteArticleParams = req.body;
        if (!articleUrl) {
            console.warn('Client Error: Missing article URL parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }

        const {isCompleted, error} = await ReadingHistoryService.completeArticle({email, articleUrl});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'ARTICLE_NOT_IN_HISTORY') {
            console.warn('Client Error: Article not in reading history'.yellow);
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

        console.log('SUCCESS: Article marked as completed'.bgGreen.bold, {articleUrl});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Article has been marked as completed 🎉',
            isCompleted,
        }));
    } catch (error: any) {
        console.error('Controller Error: completeArticleController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during article completion',
        }));
    }
}

const clearReadingHistoryController = async (req: Request, res: Response) => {
    console.info('Controller: clearReadingHistoryController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {isCleared, error} = await ReadingHistoryService.clearReadingHistories({email});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        if (isCleared) {
            console.log('SUCCESS: Reading history cleared'.bgGreen.bold);
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
        console.error('Controller Error: clearReadingHistoryController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during reading history clearance',
        }));
    }
}

const getReadingHistoryAnalyticsController = async (req: Request, res: Response) => {
    console.info('Controller: getReadingHistoryAnalyticsController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {analytics, error} = await ReadingHistoryService.getReadingAnalytics({email});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
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

        console.log('SUCCESS: Reading history analytics fetched'.bgGreen.bold);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Reading history analytics have been fetched 🎉',
            analytics,
        }));
    } catch (error: any) {
        console.error('Controller Error: getReadingHistoryAnalyticsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during reading history analytics retrieval',
        }));
    }
}

const searchReadingHistoriesController = async (req: Request, res: Response) => {
    console.info('Controller: searchReadingHistoriesController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {q, sources, sortBy, sortOrder, pageSize, page}: Partial<ISearchReadingHistoryParams> = req.query;

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
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        console.log('SUCCESS: Reading history search completed'.bgGreen.bold, {totalCount});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Search results have been found 🎉',
            searchResults: readingHistories,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('Controller Error: searchReadingHistoriesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during reading history search',
        }));
    }
}

const deleteReadingHistoryController = async (req: Request, res: Response) => {
    console.info('Controller: deleteReadingHistoryController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {readingHistoryExternalId}: IDeleteReadingHistoryParams = req.body;

        if (!readingHistoryExternalId) {
            console.warn('Client Error: Missing reading history external ID parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('reading_history_external_id'),
                errorMsg: 'Reading history external ID is missing',
            }));
            return;
        }

        const {isDeleted, error} = await ReadingHistoryService.deleteReadingHistory({email, readingHistoryExternalId});
        if (error === generateMissingCode('email')) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === generateNotFoundCode('reading_history')) {
            console.warn('Client Error: Reading history not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('reading_history'),
                errorMsg: 'Reading history not found',
            }));
            return;
        }

        if (isDeleted) {
            console.log('SUCCESS: Reading history deleted'.bgGreen.bold, {readingHistoryExternalId});
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
        console.error('Controller Error: deleteReadingHistoryController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during reading history deletion',
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
