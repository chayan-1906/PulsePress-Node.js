import "colors";
import AuthService from "./AuthService";
import AnalyticsService from "./AnalyticsService";
import ReadingHistoryModel, {IReadingHistory} from "../models/ReadingHistorySchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IClearReadingHistoryParams,
    IClearReadingHistoryResponse,
    ICompleteArticleParams,
    ICompleteArticleResponse,
    IDeleteReadingHistoryParams,
    IDeleteReadingHistoryResponse,
    IGetReadingAnalyticsParams,
    IGetReadingAnalyticsResponse,
    IGetReadingHistoryParams,
    IGetReadingHistoryResponse,
    IModifyReadingHistoryParams,
    IModifyReadingHistoryResponse,
    ISearchReadingHistoryParams,
    ISearchReadingHistoryResponse,
    SUPPORTED_READING_HISTORY_SORTINGS,
} from "../types/reading-history";
import {TIME_CONSTANTS} from "../utils/constants";

class ReadingHistoryService {
    /**
     * Create or update reading history entry with analytics tracking
     */
    static async modifyReadingHistory
    ({email, title, articleUrl, source, description, readAt, readDuration, completed, publishedAt}: IModifyReadingHistoryParams): Promise<IModifyReadingHistoryResponse> {
        console.log('Service: ReadingHistoryService.modifyReadingHistory called'.cyan.italic, {email, title, articleUrl, source, description, readAt, readDuration, completed, publishedAt});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            if (!title) {
                return {error: generateMissingCode('title')};
            }

            if (!articleUrl) {
                return {error: generateMissingCode('article_url')};
            }

            if (!source) {
                return {error: generateMissingCode('source')};
            }

            if (!readAt) {
                return {error: generateMissingCode('read_at')};
            }

            if (completed === null || typeof completed === 'undefined') {
                return {error: generateMissingCode('completed')};
            }

            if (!publishedAt) {
                return {error: generateMissingCode('published_at')};
            }

            const existingArticleHistory: IReadingHistory | null = await ReadingHistoryModel.findOne({userExternalId: user.userExternalId, articleUrl});
            if (existingArticleHistory) {
                const {modifiedCount} = await ReadingHistoryModel.updateOne(
                    {userExternalId: user.userExternalId, articleUrl},
                    {$set: {readDuration, readAt, completed}},
                );

                // Update analytics if reading time changed
                if (readDuration && readDuration !== existingArticleHistory.readDuration) {
                    await AnalyticsService.updateSourceAnalytics({source, action: 'view', readingTime: readDuration})
                        .catch((error: any) => console.error('Service Error: ReadingHistoryService.modifyReadingHistory analytics update failed:'.red.bold, error));
                }

                if (modifiedCount === 1) {
                    return {isModified: true};
                } else {
                    return {isModified: false};
                }
            }

            const savedReadingHistory: IReadingHistory | null = await ReadingHistoryModel.create({
                userExternalId: user.userExternalId,
                title,
                articleUrl,
                source,
                description,
                readAt,
                readDuration,
                completed,
                publishedAt,
            });
            console.log('Database: Reading history created'.cyan, savedReadingHistory);

            // Track analytics for new reading history
            if (savedReadingHistory) {
                await AnalyticsService.updateSourceAnalytics({source, action: 'view', readingTime: readDuration || 0})
                    .catch((error: any) => console.error('Service Error: ReadingHistoryService.modifyReadingHistory analytics update failed:'.red.bold, error));
            }

            const isModified = savedReadingHistory !== null;
            console.log('Reading history modification completed successfully'.green.bold, {isModified});
            return {isModified};
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.modifyReadingHistory failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get paginated reading history for user sorted by newest first
     */
    static async getReadingHistories({email, pageSize = 10, page = 1}: IGetReadingHistoryParams): Promise<IGetReadingHistoryResponse> {
        console.log('Service: ReadingHistoryService.getReadingHistories called'.cyan.italic, {email, pageSize, page});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const skip = (page - 1) * pageSize;
            const readingHistories = await ReadingHistoryModel
                .find({userExternalId: user.userExternalId})
                .sort({readAt: -1})  // newest first
                .skip(skip)
                .limit(pageSize);

            const totalCount = await ReadingHistoryModel.countDocuments({userExternalId: user.userExternalId});
            console.log('Database: Reading histories retrieved'.cyan, readingHistories);

            const result = {readingHistories, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
            console.log('Reading histories retrieved successfully'.green.bold, result);
            return result;
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.getReadingHistories failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Mark article as completed in reading history with analytics update
     */
    static async completeArticle({email, articleUrl}: ICompleteArticleParams): Promise<ICompleteArticleResponse> {
        console.log('Service: ReadingHistoryService.completeArticle called'.cyan.italic, {email, articleUrl});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            if (!articleUrl) {
                return {error: generateMissingCode('article_url')};
            }

            const updatedArticleHistory = await ReadingHistoryModel.findOneAndUpdate(
                {userExternalId: user.userExternalId, articleUrl},
                {$set: {completed: true}},
                {new: true},
            );
            if (!updatedArticleHistory) {
                return {error: 'ARTICLE_NOT_IN_HISTORY'};
            }
            console.log('Database: Article marked as completed'.cyan, updatedArticleHistory);

            // Track completion analytics
            await AnalyticsService.updateSourceAnalytics({source: updatedArticleHistory.source, action: 'complete', readingTime: updatedArticleHistory.readDuration || 0})
                .catch((error: any) => console.error('Service Error: ReadingHistoryService.completeArticle analytics update failed:'.red.bold, error));

            console.log('Article completion completed successfully'.green.bold, {articleUrl, isCompleted: true});
            return {isCompleted: true};
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.completeArticle failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Clear all reading history entries for user
     */
    static async clearReadingHistories({email}: IClearReadingHistoryParams): Promise<IClearReadingHistoryResponse> {
        console.log('Service: ReadingHistoryService.clearReadingHistories called'.cyan.italic, {email});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const {deletedCount, acknowledged} = await ReadingHistoryModel.deleteMany({userExternalId: user.userExternalId});
            const isCleared = acknowledged;
            console.log('Database: Reading histories cleared'.cyan, acknowledged);

            console.log('Reading histories cleared successfully'.green.bold, {isCleared});
            return {isCleared};
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.clearReadingHistories failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get comprehensive reading analytics with time-based metrics and completion rates
     */
    static async getReadingAnalytics({email}: IGetReadingAnalyticsParams): Promise<IGetReadingAnalyticsResponse> {
        console.log('Service: ReadingHistoryService.getReadingAnalytics called'.cyan.italic, {email});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(Date.now() - TIME_CONSTANTS.WEEK_IN_MS);
            const startOfMonth = new Date(Date.now() - TIME_CONSTANTS.MONTH_IN_MS);

            const [totalArticles, articlesToday, articlesWeek, articlesMonth, completedArticles, readingTimeStats] = await Promise.all([
                // total articles read ever
                ReadingHistoryModel.countDocuments({userExternalId: user.userExternalId}),

                // total articles read today
                ReadingHistoryModel.countDocuments({
                    userExternalId: user.userExternalId,
                    readAt: {$gte: startOfToday},
                }),

                // total articles read this week
                ReadingHistoryModel.countDocuments({
                    userExternalId: user.userExternalId,
                    readAt: {$gte: startOfWeek},
                }),

                // total articles read this month
                ReadingHistoryModel.countDocuments({
                    userExternalId: user.userExternalId,
                    readAt: {$gte: startOfMonth},
                }),

                // total completed articles
                ReadingHistoryModel.countDocuments({
                    userExternalId: user.userExternalId,
                    completed: true,
                }),

                // total read time
                ReadingHistoryModel.aggregate([
                    {$match: {userExternalId: user.userExternalId}},
                    {
                        $group: {
                            _id: null,
                            totalReadingTime: {$sum: '$readDuration'},
                            avgReadingTime: {$avg: '$readDuration'},
                        },
                    },
                ]),
            ]);

            const totalReadingTimeMinutes = Math.round((readingTimeStats[0]?.totalReadingTime || 0) / 60);
            const averageReadingTimeMinutes = Math.round((readingTimeStats[0]?.avgReadingTime || 0) / 60);
            const completionRate = totalArticles > 0 ? Math.round((completedArticles / totalArticles) * 100) : 0;

            const analytics = {
                articlesReadToday: articlesToday,
                articlesReadThisWeek: articlesWeek,
                articlesReadThisMonth: articlesMonth,
                totalArticlesRead: totalArticles,
                totalReadingTimeMinutes,
                averageReadingTimeMinutes,
                completedArticlesCount: completedArticles,
                completionRate,
            };
            console.log('Reading analytics retrieved successfully'.green.bold, analytics);
            return {analytics};
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.getReadingAnalytics failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Search reading history with text query, source filters, and sorting options
     */
    static async searchReadingHistories({email, q, sources, sortBy = 'readAt', sortOrder = 'desc', pageSize = 10, page = 1}: ISearchReadingHistoryParams): Promise<ISearchReadingHistoryResponse> {
        console.log('Service: ReadingHistoryService.searchReadingHistories called'.cyan.italic, {email, q, sources, sortBy, sortOrder, pageSize, page});

        /**
         * userExternalId — filters for the specific user (AND)
         * source (if provided) — filters by source (AND)
         * $or — searches title, articleUrl, description, source for keyword q (OR)
         * */

        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const skip = (page - 1) * pageSize;
            const filter: any = {userExternalId: user.userExternalId};

            // Full-text search
            if (typeof q === 'string' && q.trim()) {
                const regex = {$regex: q.trim(), $options: 'i'};
                filter.$or = [
                    {title: regex},
                    {articleUrl: regex},
                    {source: regex},
                    {description: regex},
                ];
            }

            // Filter by source(s)
            const sourceArray = sources?.split(',').map(s => s.trim()).filter(Boolean);
            if (sourceArray?.length) {
                filter.source = {$in: sourceArray};
            }

            const sortField = SUPPORTED_READING_HISTORY_SORTINGS.includes(sortBy) ? sortBy : 'createdAt';
            const sortDirection = sortOrder === 'asc' ? 1 : -1;

            console.log('Database: Search filter applied'.cyan, filter);

            const readingHistories = await ReadingHistoryModel.find(filter)
                .sort({[sortField]: sortDirection})
                .skip(skip)
                .limit(pageSize);

            const totalCount = await ReadingHistoryModel.countDocuments(filter);

            const result = {
                readingHistories,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / pageSize),
            };
            console.log('Reading history search completed successfully'.green.bold, result);
            return result;
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.searchReadingHistories failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Delete specific reading history entry by external ID
     */
    static async deleteReadingHistory({email, readingHistoryExternalId}: IDeleteReadingHistoryParams): Promise<IDeleteReadingHistoryResponse> {
        console.log('Service: ReadingHistoryService.deleteReadingHistory called'.cyan.italic, {email, readingHistoryExternalId});

        try {
            const {user, error} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            if (!readingHistoryExternalId) {
                return {error: generateMissingCode('reading_history_external_id')};
            }

            const {deletedCount, acknowledged} = await ReadingHistoryModel.deleteOne({userExternalId: user.userExternalId, readingHistoryExternalId});
            if (deletedCount === 0) {
                return {error: generateNotFoundCode('reading_history')};
            }
            const isDeleted = deletedCount === 1 && acknowledged;
            console.log('Database: Reading history deleted'.cyan, acknowledged);

            console.log('Reading history deletion completed successfully'.green.bold, {isDeleted});
            return {isDeleted};
        } catch (error: any) {
            console.error('Service Error: ReadingHistoryService.deleteReadingHistory failed:'.red.bold, error);
            throw error;
        }
    }
}

export default ReadingHistoryService;
