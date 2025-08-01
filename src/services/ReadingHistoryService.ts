import {getUserByEmail} from "./AuthService";
import {updateSourceAnalytics} from "./AnalyticsService";
import ReadingHistoryModel, {IReadingHistory} from "../models/ReadingHistorySchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    ClearReadingHistoryParams,
    ClearReadingHistoryResponse,
    CompleteArticleParams,
    CompleteArticleResponse,
    DeleteReadingHistoryParams,
    DeleteReadingHistoryResponse,
    GetReadingAnalyticsParams,
    GetReadingAnalyticsResponse,
    GetReadingHistoryParams,
    GetReadingHistoryResponse,
    ModifyReadingHistoryParams,
    ModifyReadingHistoryResponse,
    SearchReadingHistoryParams,
    SearchReadingHistoryResponse,
    SUPPORTED_READING_HISTORY_SORTINGS,
} from "../types/reading-history";

const modifyReadingHistory = async (
    {email, title, articleUrl, source, description, readAt, readDuration, completed, publishedAt}: ModifyReadingHistoryParams): Promise<ModifyReadingHistoryResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
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
                await updateSourceAnalytics({source, action: 'view', readingTime: readDuration})
                    .catch((error: any) => console.error('Analytics update failed:'.red.bold, error));
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
        console.log('savedReadingHistory:'.cyan.italic, savedReadingHistory);

        // Track analytics for new reading history
        if (savedReadingHistory) {
            await updateSourceAnalytics({
                source, action: 'view', readingTime: readDuration || 0,
            }).catch((error: any) => console.error('Analytics update failed:'.red.bold, error));
        }

        return {isModified: savedReadingHistory !== null};
    } catch (error: any) {
        console.error('ERROR: inside catch of modifyReadingHistory:'.red.bold, error);
        throw error;
    }
}

const getReadingHistories = async ({email, pageSize = 10, page = 1}: GetReadingHistoryParams): Promise<GetReadingHistoryResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
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
        console.log('readingHistories:'.cyan.italic, readingHistories);

        return {readingHistories, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / pageSize)};
    } catch (error: any) {
        console.error('ERROR: inside catch of getReadingHistories:'.red.bold, error);
        throw error;
    }
}

const completeArticle = async ({email, articleUrl}: CompleteArticleParams): Promise<CompleteArticleResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
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
        console.log('completedArticle:'.cyan.italic, updatedArticleHistory);

        // Track completion analytics
        await updateSourceAnalytics({source: updatedArticleHistory.source, action: 'complete', readingTime: updatedArticleHistory.readDuration || 0})
            .catch((error: any) => console.error('Analytics update failed:'.red.bold, error));

        return {isCompleted: true};
    } catch (error: any) {
        console.error('ERROR: inside catch of completeArticle:'.red.bold, error);
        throw error;
    }
}

const clearReadingHistories = async ({email}: ClearReadingHistoryParams): Promise<ClearReadingHistoryResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const {deletedCount, acknowledged} = await ReadingHistoryModel.deleteMany({userExternalId: user.userExternalId});
        const isCleared = acknowledged;
        console.log('isCleared:'.cyan.italic, acknowledged);

        return {isCleared};
    } catch (error: any) {
        console.error('ERROR: inside catch of clearReadingHistories:'.red.bold, error);
        throw error;
    }
}

const getReadingAnalytics = async ({email}: GetReadingAnalyticsParams): Promise<GetReadingAnalyticsResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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

        return {
            analytics: {
                articlesReadToday: articlesToday,
                articlesReadThisWeek: articlesWeek,
                articlesReadThisMonth: articlesMonth,
                totalArticlesRead: totalArticles,
                totalReadingTimeMinutes,
                averageReadingTimeMinutes,
                completedArticlesCount: completedArticles,
                completionRate,
            },
        };
    } catch (error: any) {
        console.error('ERROR: inside catch of getReadingAnalytics:', error);
        throw error;
    }
}

const searchReadingHistories = async (
    {email, q, sources, sortBy = 'readAt', sortOrder = 'desc', pageSize = 10, page = 1,}: SearchReadingHistoryParams): Promise<SearchReadingHistoryResponse> => {
    /**
     * userExternalId — filters for the specific user (AND)
     * source (if provided) — filters by source (AND)
     * $or — searches title, articleUrl, description, source for keyword q (OR)
     * */

    try {
        const {user} = await getUserByEmail({email});
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

        console.log('Filter used in searchReadingHistories:', filter);

        const readingHistories = await ReadingHistoryModel.find(filter)
            .sort({[sortField]: sortDirection})
            .skip(skip)
            .limit(pageSize);

        const totalCount = await ReadingHistoryModel.countDocuments(filter);

        return {
            readingHistories,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / pageSize),
        };
    } catch (error: any) {
        console.error('ERROR in searchReadingHistories:', error);
        throw error;
    }
}

const deleteReadingHistory = async ({email, readingHistoryExternalId}: DeleteReadingHistoryParams): Promise<DeleteReadingHistoryResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
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
        console.log('isDeleted:'.cyan.italic, acknowledged);

        return {isDeleted};
    } catch (error: any) {
        console.error('ERROR: inside catch of deleteReadingHistory:'.red.bold, error);
        throw error;
    }
}

export {modifyReadingHistory, getReadingHistories, completeArticle, clearReadingHistories, getReadingAnalytics, searchReadingHistories, deleteReadingHistory};
