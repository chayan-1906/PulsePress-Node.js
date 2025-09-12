import "colors";
import AuthService from "./AuthService";
import AnalyticsService from "./AnalyticsService";
import BookmarkModel, {IBookmark} from "../models/BookmarkSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IGetAllBookmarksParams,
    IGetAllBookmarksResponse,
    IGetBookmarkCountResponse,
    IIsBookmarkedParams,
    IIsBookmarkedResponse,
    ISearchBookmarksParams,
    ISearchBookmarksResponse,
    IToggleBookmarkParams,
    IToggleBookmarkResponse,
    SUPPORTED_BOOKMARK_SORTINGS,
} from "../types/bookmark";

class BookmarkService {
    /**
     * Toggle bookmark status for an article (add if not bookmarked, remove if bookmarked)
     */
    static async toggleBookmark({email, articleUrl, title, source, description, imageUrl, publishedAt}: IToggleBookmarkParams): Promise<IToggleBookmarkResponse> {
        console.log('Service: BookmarkService.toggleBookmark called'.cyan.italic, {email, articleUrl, title, source});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                // TODO Question: Is it needed? AuthService.getUserByEmail already returns generateNotFoundCode('user'); Need to call /bookmark/toggle (PUT) with a deleted user's token...
                //  Temporarily create abcd@gmail.com & delete
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
                    console.log('Database: Bookmark deleted'.cyan, {isDeleted, deletedCount});

                    if (isDeleted) {
                        await AnalyticsService.updateSourceAnalytics({source, action: 'unbookmark'})
                            .catch((error: any) => console.error('Service Error: Analytics update failed'.red.bold, error));
                    }

                    console.log('Bookmark removal completed successfully'.green.bold);
                    return {deleted: isDeleted};
                } else {
                    // not bookmarked → add it
                    const savedBookmark = await BookmarkModel.create({
                        userExternalId: user.userExternalId,
                        articleUrl, title, source, description, imageUrl, publishedAt,
                    });
                    console.log('Database: Bookmark created'.cyan, savedBookmark);

                    if (savedBookmark) {
                        await AnalyticsService.updateSourceAnalytics({source, action: 'bookmark'})
                            .catch((error: any) => console.error('Service Error: Analytics update failed'.red.bold, error));
                    }

                    console.log('Bookmark addition completed successfully'.green.bold);
                    return {added: true, bookmark: savedBookmark};
                }
            }

            return {error: isBookedMarkedError};
        } catch (error: any) {
            console.error('Service Error: BookmarkService.toggleBookmark failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Check if an article is bookmarked by user
     */
    static async getBookmarkStatus({email, articleUrl}: IIsBookmarkedParams): Promise<IIsBookmarkedResponse> {
        console.log('Service: BookmarkService.getBookmarkStatus called'.cyan.italic, {email, articleUrl});

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
                console.log('Database: Article not bookmarked'.cyan);
                console.log('Bookmark status check completed successfully'.green.bold);
                return {isBookmarked: false};
            }
            console.log('Database: Article found in bookmarks'.cyan, bookmarkedArticle);

            console.log('Bookmark status check completed successfully'.green.bold);
            return {isBookmarked: true};
        } catch (error: any) {
            console.error('Service Error: BookmarkService.getBookmarkStatus failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get all bookmarked articles for user with pagination
     */
    static async getAllBookmarks({email, pageSize = 10, page = 1}: IGetAllBookmarksParams): Promise<IGetAllBookmarksResponse> {
        console.log('Service: BookmarkService.getAllBookmarks called'.cyan.italic, {email, pageSize, page});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const skip = (page - 1) * pageSize;
            console.log('Database: Querying bookmarks'.cyan, {skip, pageSize});
            const bookmarkedArticles: IBookmark[] | null = await BookmarkModel
                .find({userExternalId: user.userExternalId})
                .sort({createdAt: -1})  // descending order
                .skip(skip)
                .limit(pageSize);
            console.log('Database: Bookmarks retrieved'.cyan, {count: bookmarkedArticles?.length});

            const totalCount = await BookmarkModel.countDocuments({userExternalId: user.userExternalId});
            console.log('Database: Total bookmark count retrieved'.cyan, {totalCount});

            console.log('Get all bookmarks completed successfully'.green.bold);
            return {bookmarkedArticles, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
        } catch (error: any) {
            console.error('Service Error: BookmarkService.getAllBookmarks failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get total count of bookmarked articles for user
     */
    static async getBookmarkCount({email}: IGetAllBookmarksParams): Promise<IGetBookmarkCountResponse> {
        console.log('Service: BookmarkService.getBookmarkCount called'.cyan.italic, {email});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const count = await BookmarkModel.countDocuments({userExternalId: user.userExternalId});
            console.log('Database: Bookmark count retrieved'.cyan, {count});

            console.log('Get bookmark count completed successfully'.green.bold);
            return {count};
        } catch (error: any) {
            console.error('Service Error: BookmarkService.getBookmarkCount failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Search bookmarked articles with filters, sorting, and pagination
     */
    static async searchBookmarks({email, q, sources, sortBy = 'createdAt', sortOrder = 'desc', pageSize = 10, page = 1}: ISearchBookmarksParams): Promise<ISearchBookmarksResponse> {
        console.log('Service: BookmarkService.searchBookmarks called'.cyan.italic, {email, q, sources, sortBy, sortOrder, pageSize, page});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const skip = (page - 1) * pageSize;
            const filter: any = {userExternalId: user.userExternalId};

            if (typeof q === 'string' && q.trim()) {
                const regex = {$regex: q.trim(), $options: 'i'};
                filter.$or = [
                    {articleUrl: regex},
                    {title: regex},
                    {source: regex},
                    {description: regex},
                ];
            }

            const sourceArray = sources?.split(',').map(s => s.trim()).filter(Boolean);
            if (sourceArray?.length) {
                filter.source = {$in: sourceArray};
            }

            const sortField = SUPPORTED_BOOKMARK_SORTINGS.includes(sortBy) ? sortBy : 'createdAt';
            const sortDirection = sortOrder === 'asc' ? 1 : -1;

            console.log('Database: Search filter constructed'.cyan, filter);

            const searchedArticles = await BookmarkModel.find(filter)
                .sort({[sortField]: sortDirection})
                .skip(skip)
                .limit(pageSize);

            const totalCount = await BookmarkModel.countDocuments(filter);
            console.log('Database: Search results retrieved'.cyan, {resultCount: searchedArticles.length, totalCount});

            console.log('Bookmark search completed successfully'.green.bold);
            return {bookmarks: searchedArticles, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
        } catch (error: any) {
            console.error('Service Error: BookmarkService.searchBookmarks failed'.red.bold, error);
            throw error;
        }
    }
}

export default BookmarkService;
