import "colors";
import {getUserByEmail} from "./AuthService";
import BookmarkModel, {IBookmark} from "../models/BookmarkSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {GetAllBookmarksParams, GetAllBookmarksResponse, GetBookmarkCountResponse, IsBookmarkedParams, IsBookmarkedResponse, ToggleBookmarkParams, ToggleBookmarkResponse} from "../types/bookmark";

const toggleBookmark = async ({email, articleUrl, title, source, description, imageUrl}: ToggleBookmarkParams): Promise<ToggleBookmarkResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        if (!articleUrl) {
            return {error: generateMissingCode('articleUrl')};
        }
        if (!title) {
            return {error: generateMissingCode('title')};
        }
        if (!source) {
            return {error: generateMissingCode('source')};
        }

        const {isBookmarked, error: isBookedMarkedError} = await getBookmarkStatus({email, articleUrl});
        if (!isBookedMarkedError) {
            if (isBookmarked) {
                // already bookmarked → remove it
                const {deletedCount} = await BookmarkModel.deleteOne({userExternalId: user.userExternalId, articleUrl});
                const isDeleted = deletedCount === 1;
                console.log('Bookmark deleted:'.cyan.italic, isDeleted);

                return {deleted: isDeleted};
            } else {
                // not bookmarked → add it
                const savedBookmark = await BookmarkModel.create({
                    userExternalId: user.userExternalId,
                    articleUrl, title, source, description, imageUrl,
                });
                console.log('savedBookmark:'.cyan.italic, savedBookmark);

                return {added: true, bookmark: savedBookmark};
            }
        }

        return {error: isBookedMarkedError};
    } catch (error: any) {
        console.error('ERROR: inside catch of toggleBookmark:'.red.bold, error);
        throw error;
    }
}

const getBookmarkStatus = async ({email, articleUrl}: IsBookmarkedParams): Promise<IsBookmarkedResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        if (!articleUrl) {
            return {error: generateMissingCode('articleUrl')};
        }

        const bookmarkedArticle: IBookmark | null = await BookmarkModel.findOne({userExternalId: user.userExternalId, articleUrl});
        if (!bookmarkedArticle) {
            return {isBookmarked: false};
        }
        console.log('bookmarkedArticle:'.cyan.italic, bookmarkedArticle);

        return {isBookmarked: true};
    } catch (error: any) {
        console.error('ERROR: inside catch of getBookmarkStatus:'.red.bold, error);
        throw error;
    }
}

const getAllBookmarks = async ({email, pageSize = 10, page = 1}: GetAllBookmarksParams): Promise<GetAllBookmarksResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const skip = (page - 1) * pageSize;
        const bookmarkedArticles: IBookmark[] | null = await BookmarkModel
            .find({userExternalId: user.userExternalId})
            .sort({createdAt: -1})  // descending order
            .skip(skip)
            .limit(pageSize);
        console.log('bookmarkedArticles:'.cyan.italic, bookmarkedArticles);

        const totalCount = await BookmarkModel.countDocuments({userExternalId: user.userExternalId});

        return {bookmarkedArticles, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
    } catch (error: any) {
        console.error('ERROR: inside catch of getAllBookmarks:'.red.bold, error);
        throw error;
    }
}

const getBookmarkCount = async ({email}: GetAllBookmarksParams): Promise<GetBookmarkCountResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const count = await BookmarkModel.countDocuments({userExternalId: user.userExternalId});
        console.log('count:'.cyan.italic, count);

        return {count};
    } catch (error: any) {
        console.error('ERROR: inside catch of getBookmarkCount:'.red.bold, error);
        throw error;
    }
}

export {toggleBookmark, getBookmarkStatus, getAllBookmarks, getBookmarkCount};
