import {getUserByEmail} from "./AuthService";
import ReadingHistoryModel, {IReadingHistory} from "../models/ReadingHistorySchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    ClearHistoryParams,
    ClearHistoryResponse,
    CompleteArticleParams,
    CompleteArticleResponse,
    GetReadingAnalyticsParams,
    GetReadingAnalyticsResponse,
    GetReadingHistoryParams,
    GetReadingHistoryResponse,
    ModifyReadingHistoryParams,
    ModifyReadingHistoryResponse
} from "../types/reading-history";

const modifyReadingHistory = async ({email, articleUrl, readAt, readDuration, completed}: ModifyReadingHistoryParams): Promise<ModifyReadingHistoryResponse> => {
    try {
        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        if (!articleUrl) {
            return {error: generateMissingCode('articleUrl')};
        }
        if (!readAt) {
            return {error: generateMissingCode('readAt')};
        }
        if (completed === null || typeof completed === 'undefined') {
            return {error: generateMissingCode('completed')};
        }

        const existingArticleHistory: IReadingHistory | null = await ReadingHistoryModel.findOne({userExternalId: user.userExternalId, articleUrl});
        if (existingArticleHistory) {
            const {modifiedCount} = await ReadingHistoryModel.updateOne(
                {userExternalId: user.userExternalId, articleUrl},
                {$set: {readDuration, readAt, completed}},
            );
            if (modifiedCount === 1) {
                return {isModified: true};
            } else {
                return {isModified: false};
            }
        }

        const savedReadingHistory: IReadingHistory | null = await ReadingHistoryModel.create({userExternalId: user.userExternalId, articleUrl, readAt, readDuration, completed});
        console.log('savedReadingHistory:'.cyan.italic, savedReadingHistory);

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
            return {error: generateMissingCode('articleUrl')};
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

        return {isCompleted: true};
    } catch (error: any) {
        console.error('ERROR: inside catch of completeArticle:'.red.bold, error);
        throw error;
    }
}

const clearHistory = async ({email}: ClearHistoryParams): Promise<ClearHistoryResponse> => {
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
        console.error('ERROR: inside catch of clearHistory:'.red.bold, error);
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

        const [
            totalArticles,
            articlesToday,
            articlesWeek,
            articlesMonth,
            completedArticles,
            readingTimeStats
        ] = await Promise.all([
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

export {modifyReadingHistory, getReadingHistories, completeArticle, clearHistory, getReadingAnalytics};
