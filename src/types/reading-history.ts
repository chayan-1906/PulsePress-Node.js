import {IReadingHistory} from "../models/ReadingHistorySchema";


/** ------------- API response types ------------- */

export interface ModifyReadingHistoryResponse {
    isModified?: boolean;
    error?: string;
}

export interface GetReadingHistoryResponse {
    readingHistories?: IReadingHistory[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface CompleteArticleResponse {
    isCompleted?: boolean;
    error?: string;
}

export interface ClearHistoryResponse {
    isCleared?: boolean;
    error?: string;
}

export interface GetReadingAnalyticsResponse {
    analytics?: {
        articlesReadToday: number;
        articlesReadThisWeek: number;
        articlesReadThisMonth: number;
        totalArticlesRead: number;
        totalReadingTimeMinutes: number;
        averageReadingTimeMinutes: number;
        completedArticlesCount: number;
        completionRate: number;
    };
    error?: string;
}


/** ------------- function params ------------- */

export interface ModifyReadingHistoryParams {
    email: string;
    articleUrl: string;
    readAt: String;
    readDuration?: number;  // in seconds
    completed: boolean;
}

export interface GetReadingHistoryParams {
    email: string;
    pageSize?: number;
    page?: number;
}

export interface CompleteArticleParams {
    email: string;
    articleUrl: string;
}

export interface ClearHistoryParams {
    email: string;
}

export interface GetReadingAnalyticsParams {
    email: string;
}
