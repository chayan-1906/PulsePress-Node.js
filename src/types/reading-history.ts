import {SupportedSource} from "./news";
import {IReadingHistory} from "../models/ReadingHistorySchema";

export const SUPPORTED_READING_HISTORY_SORTINGS = ['title', 'articleUrl', 'source', 'readAt', 'readDuration', 'createdAt', 'publishedAt'];
type SupportedReadingHistorySorting = typeof SUPPORTED_READING_HISTORY_SORTINGS[number];


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

export interface ClearReadingHistoryResponse {
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

export interface SearchReadingHistoryResponse {
    readingHistories?: IReadingHistory[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface DeleteReadingHistoryResponse {
    isDeleted?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface ModifyReadingHistoryParams {
    email: string;
    title: string;
    articleUrl: string;
    source: string;
    description?: string;
    readAt: String;
    readDuration?: number;  // in seconds
    completed: boolean;
    publishedAt: Date;
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

export interface ClearReadingHistoryParams {
    email: string;
}

export interface GetReadingAnalyticsParams {
    email: string;
}

export interface SearchReadingHistoryParams {
    email: string;
    q?: string;
    sources?: SupportedSource;
    sortBy?: SupportedReadingHistorySorting;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
    page?: number;
}

export interface DeleteReadingHistoryParams {
    email: string;
    readingHistoryExternalId: string;
}
