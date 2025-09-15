import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import BookmarkService from "../services/BookmarkService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {IGetAllBookmarksParams, IIsBookmarkedParams, ISearchBookmarksParams, IToggleBookmarkParams} from "../types/bookmark";

const toggleBookmarkController = async (req: Request, res: Response) => {
    console.info('Controller: toggleBookmarkController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {articleUrl, title, source, description, imageUrl, publishedAt}: Partial<IToggleBookmarkParams> = req.body;
        if (!articleUrl) {
            console.warn('Client Error: Missing article URL parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }
        if (!title) {
            console.warn('Client Error: Missing title parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('title'),
                errorMsg: 'Title is missing',
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
        if (!publishedAt) {
            console.warn('Client Error: Missing publishedAt parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('published_at'),
                errorMsg: 'Published date is missing',
            }));
            return;
        }

        const {bookmark, added, deleted, error} = await BookmarkService.toggleBookmark({email, articleUrl, title, source, description, imageUrl, publishedAt});

        if (error) {
            let errorMsg = 'Failed to add/remove bookmark';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === generateMissingCode('articleUrl')) {
                errorMsg = 'Article URL is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('title')) {
                errorMsg = 'Title is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('source')) {
                errorMsg = 'Source is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('published_at')) {
                errorMsg = 'Published date is missing';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        if (added) {
            console.log('SUCCESS: Article bookmarked'.bgGreen.bold, {articleUrl});
            res.status(201).send(new ApiResponse({
                success: true,
                message: 'Article has been bookmarked 🎉',
                bookmarked: true,
                bookmark,
            }));
            return;
        } else if (deleted) {
            console.log('SUCCESS: Article removed from bookmarks'.bgGreen.bold, {articleUrl});
            res.status(200).send(new ApiResponse({
                success: true,
                message: 'Article has been removed from bookmark 🎉',
                bookmarked: false,
            }));
            return;
        } else if (deleted === false) {
            // unbookmark failed
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'DELETE_BOOKMARK_FAILED',
                errorMsg: 'Failed to remove article from bookmark',
                bookmarked: false,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: toggleBookmarkController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during bookmark toggle',
        }));
    }
}

const isBookmarkedController = async (req: Request, res: Response) => {
    console.info('Controller: isBookmarkedController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {articleUrl}: Partial<IIsBookmarkedParams> = req.query;
        if (!articleUrl) {
            console.warn('Client Error: Missing article URL parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }

        const {isBookmarked, error} = await BookmarkService.getBookmarkStatus({email, articleUrl});

        if (error) {
            let errorMsg = 'Failed to get bookmark status';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === generateMissingCode('articleUrl')) {
                errorMsg = 'Article URL is missing';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: Bookmark status fetched'.bgGreen.bold, {isBookmarked});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Bookmark status has been fetched 🎉',
            isBookmarked,
        }));
    } catch (error: any) {
        console.error('Controller Error: isBookmarkedController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during bookmark status retrieval',
        }));
    }
}

const getAllBookmarksController = async (req: Request, res: Response) => {
    console.info('Controller: getAllBookmarksController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {pageSize, page}: Partial<IGetAllBookmarksParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {bookmarkedArticles, totalCount, currentPage, totalPages, error} = await BookmarkService.getAllBookmarks({email, pageSize: pageSizeNumber, page: pageNumber});

        if (error) {
            let errorMsg = 'Failed to get all bookmarks';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: Bookmarked articles fetched'.bgGreen.bold, {totalCount});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Bookmarked articles have been fetched 🎉',
            bookmarks: bookmarkedArticles,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('Controller Error: getAllBookmarksController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during bookmark retrieval',
        }));
    }
}

const getBookmarkCountController = async (req: Request, res: Response) => {
    console.info('Controller: getBookmarkCountController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {count, error} = await BookmarkService.getBookmarkCount({email});

        if (error) {
            let errorMsg = 'Failed to get bookmark count';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: Bookmark count fetched'.bgGreen.bold, {count});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'No. of bookmarked articles has been fetched 🎉',
            bookmarkCount: count,
        }));
    } catch (error: any) {
        console.error('Controller Error: getBookmarkCountController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during bookmark count retrieval',
        }));
    }
}

const searchBookmarksController = async (req: Request, res: Response) => {
    console.info('Controller: searchBookmarksController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {q, sources, sortBy, sortOrder, pageSize, page}: Partial<ISearchBookmarksParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {bookmarks, totalCount, currentPage, totalPages, error} = await BookmarkService.searchBookmarks({email, q, sources, sortBy, sortOrder, pageSize: pageSizeNumber, page: pageNumber});

        if (error) {
            let errorMsg = 'Failed to search bookmarks';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: Bookmark search completed'.bgGreen.bold, {totalCount});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Search results have been found 🎉',
            searchResults: bookmarks,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('Controller Error: searchBookmarksController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during bookmark search',
        }));
    }
}

export {toggleBookmarkController, isBookmarkedController, getAllBookmarksController, getBookmarkCountController, searchBookmarksController};
