import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {getAllBookmarks, getBookmarkCount, getBookmarkStatus, toggleBookmark} from "../services/BookmarkService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {GetAllBookmarksParams, IsBookmarkedParams, ToggleBookmarkParams} from "../types/bookmark";

const toggleBookmarkController = async (req: Request, res: Response) => {
    console.log('toggleBookmarkController called');

    try {
        const email = (req as AuthRequest).email;
        const {articleUrl, title, source, description, imageUrl}: Partial<ToggleBookmarkParams> = req.body;
        if (!articleUrl) {
            console.error('Article URL is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }
        if (!title) {
            console.error('Title is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('title'),
                errorMsg: 'Title is missing',
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

        const {bookmark, added, deleted, error} = await toggleBookmark({email, articleUrl, title, source, description, imageUrl});
        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error) {
            console.error('Toggle bookmark failed'.yellow.italic);
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'TOGGLE_BOOKMARK_FAILED',
                errorMsg: 'Failed to add/remove bookmark',
            }));
            return;
        }

        if (added) {
            // bookmarked
            res.status(201).send(new ApiResponse({
                success: true,
                message: 'Article has been bookmarked 🎉',
                bookmarked: true,
                bookmark,
            }));
            return;
        } else if (deleted) {
            // bookmark deleted
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
        console.error('ERROR: inside catch of toggleBookmarkController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const isBookmarkedController = async (req: Request, res: Response) => {
    console.log('isBookmarkedController called');

    try {
        const email = (req as AuthRequest).email;
        const {articleUrl}: Partial<IsBookmarkedParams> = req.query;
        if (!articleUrl) {
            console.error('Article URL is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleUrl'),
                errorMsg: 'Article URL is missing',
            }));
            return;
        }

        const {isBookmarked, error} = await getBookmarkStatus({email, articleUrl});
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
        console.log('isBookmarked:'.cyan.italic, isBookmarked);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Bookmark status has been fetched 🎉',
            isBookmarked,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of isBookmarkedController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getAllBookmarksController = async (req: Request, res: Response) => {
    console.log('getAllBookmarksController called');

    try {
        const email = (req as AuthRequest).email;
        const {pageSize, page}: Partial<GetAllBookmarksParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const {bookmarkedArticles, totalCount, currentPage, totalPages, error} = await getAllBookmarks({email, pageSize: pageSizeNumber, page: pageNumber});
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
        console.log('bookmarkedArticles:'.cyan.italic, bookmarkedArticles);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Bookmarked articles has been fetched 🎉',
            bookmarks: bookmarkedArticles,
            totalCount,
            currentPage,
            totalPages,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getAllBookmarksController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getBookmarkCountController = async (req: Request, res: Response) => {
    console.log('getBookmarkCountController called');

    try {
        const email = (req as AuthRequest).email;

        const {count, error} = await getBookmarkCount({email});
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
        console.log('bookmark count:'.cyan.italic, count);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'No. of bookmarked articles has been fetched 🎉',
            bookmarkCount: count,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getBookmarkCountController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

export {toggleBookmarkController, isBookmarkedController, getAllBookmarksController, getBookmarkCountController};
