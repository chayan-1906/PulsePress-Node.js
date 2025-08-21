import "colors";
import AuthService from "./AuthService";
import AnalyticsService from "./AnalyticsService";
import BookmarkModel, {IBookmark} from "../models/BookmarkSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    GetAllBookmarksParams,
    GetAllBookmarksResponse,
    GetBookmarkCountResponse,
    IsBookmarkedParams,
    IsBookmarkedResponse,
    SearchBookmarksParams,
    SearchBookmarksResponse,
    SUPPORTED_BOOKMARK_SORTINGS,
    ToggleBookmarkParams,
    ToggleBookmarkResponse,
} from "../types/bookmark";

class BookmarkService {
    static async toggleBookmark({email, articleUrl, title, source, description, imageUrl, publishedAt}: ToggleBookmarkParams): Promise<ToggleBookmarkResponse> {
        try {
            const {user, error} = await AuthService.getUserByEmail({email});
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
            if (!publishedAt) {
                return {error: generateMissingCode('published_at')};
            }

            const {isBookmarked, error: isBookedMarkedError} = await this.getBookmarkStatus({email, articleUrl});
            if (!isBookedMarkedError) {
                if (isBookmarked) {
                    // already bookmarked → remove it
                    const {deletedCount} = await BookmarkModel.deleteOne({userExternalId: user.userExternalId, articleUrl});
                    const isDeleted = deletedCount === 1;
                    console.log('Bookmark deleted:'.cyan.italic, isDeleted);

                    // Track unbookmark analytics
                    if (isDeleted) {
                        await AnalyticsService.updateSourceAnalytics({source, action: 'unbookmark'})
                            .catch((error: any) => console.error('Analytics update failed:'.red.bold, error));
                    }

                    return {deleted: isDeleted};
                } else {
                    // not bookmarked → add it
                    const savedBookmark = await BookmarkModel.create({
                        userExternalId: user.userExternalId,
                        articleUrl, title, source, description, imageUrl, publishedAt,
                    });
                    console.log('savedBookmark:'.cyan.italic, savedBookmark);

                    // Track bookmark analytics
                    if (savedBookmark) {
                        await AnalyticsService.updateSourceAnalytics({source, action: 'bookmark'})
                            .catch((error: any) => console.error('Analytics update failed:'.red.bold, error));
                    }

                    return {added: true, bookmark: savedBookmark};
                }
            }

            return {error: isBookedMarkedError};
        } catch (error: any) {
            console.error('ERROR: inside catch of toggleBookmark:'.red.bold, error);
            throw error;
        }
    }

    static async getBookmarkStatus({email, articleUrl}: IsBookmarkedParams): Promise<IsBookmarkedResponse> {
        try {
            const {user, error} = await AuthService.getUserByEmail({email});
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

    static async getAllBookmarks({email, pageSize = 10, page = 1}: GetAllBookmarksParams): Promise<GetAllBookmarksResponse> {
        try {
            const {user, error} = await AuthService.getUserByEmail({email});
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

    static async getBookmarkCount({email}: GetAllBookmarksParams): Promise<GetBookmarkCountResponse> {
        try {
            const {user, error} = await AuthService.getUserByEmail({email});
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

    static async searchBookmarks({email, q, sources, sortBy = 'createdAt', sortOrder = 'desc', pageSize = 10, page = 1}: SearchBookmarksParams): Promise<SearchBookmarksResponse> {
        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const skip = (page - 1) * pageSize;
            const filter: any = {userExternalId: user.userExternalId};

            // Full-text search
            if (typeof q === 'string' && q.trim()) {
                const regex = {$regex: q.trim(), $options: 'i'};
                filter.$or = [
                    {articleUrl: regex},
                    {title: regex},
                    {source: regex},
                    {description: regex},
                ];
            }

            // Filter by source(s)
            const sourceArray = sources?.split(',').map(s => s.trim()).filter(Boolean);
            if (sourceArray?.length) {
                filter.source = {$in: sourceArray};
            }

            const sortField = SUPPORTED_BOOKMARK_SORTINGS.includes(sortBy) ? sortBy : 'createdAt';
            const sortDirection = sortOrder === 'asc' ? 1 : -1;

            console.info('Filter used in searchBookmarks:'.bgMagenta.white.italic, filter);

            const searchedArticles = await BookmarkModel.find(filter)
                .sort({[sortField]: sortDirection})
                .skip(skip)
                .limit(pageSize);

            const totalCount = await BookmarkModel.countDocuments(filter);
            console.log('searched bookmarked articles:'.cyan.italic, searchedArticles);

            return {bookmarks: searchedArticles, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
        } catch (error: any) {
            console.error('ERROR: inside catch of searchBookmarks:'.red.bold, error);
            throw error;
        }
    }
}

export default BookmarkService;
