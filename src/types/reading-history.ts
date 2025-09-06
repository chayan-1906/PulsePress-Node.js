import {TSupportedSource} from "./news";
import {IReadingHistory} from "../models/ReadingHistorySchema";

export const SUPPORTED_READING_HISTORY_SORTINGS = ['title', 'articleUrl', 'source', 'readAt', 'readDuration', 'createdAt', 'publishedAt'];
type TSupportedReadingHistorySorting = typeof SUPPORTED_READING_HISTORY_SORTINGS[number];


/** ------------- API response types ------------- */

export interface IModifyReadingHistoryResponse {
    isModified?: boolean;
    error?: string;
}

export interface IGetReadingHistoryResponse {
    readingHistories?: IReadingHistory[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface ICompleteArticleResponse {
    isCompleted?: boolean;
    error?: string;
}

export interface IClearReadingHistoryResponse {
    isCleared?: boolean;
    error?: string;
}

export interface IGetReadingAnalyticsResponse {
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

export interface ISearchReadingHistoryResponse {
    readingHistories?: IReadingHistory[] | null;
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    error?: string;
}

export interface IDeleteReadingHistoryResponse {
    isDeleted?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface IModifyReadingHistoryParams {
    email: string;  // for authMiddleware
    title: string;
    articleUrl: string;
    source: string;
    description?: string;
    readAt: String;
    readDuration?: number;  // in seconds
    completed: boolean;
    publishedAt: Date;
}

export interface IGetReadingHistoryParams {
    email: string;  // for authMiddleware
    pageSize?: number;
    page?: number;
}

export interface ICompleteArticleParams {
    email: string;  // for authMiddleware
    articleUrl: string;
}

export interface IClearReadingHistoryParams {
    email: string;  // for authMiddleware
}

export interface IGetReadingAnalyticsParams {
    email: string;  // for authMiddleware
}

export interface ISearchReadingHistoryParams {
    email: string;  // for authMiddleware
    q?: string;
    sources?: TSupportedSource;
    sortBy?: TSupportedReadingHistorySorting;
    sortOrder?: 'asc' | 'desc';
    pageSize?: number;
    page?: number;
}

export interface IDeleteReadingHistoryParams {
    email: string;  // for authMiddleware
    readingHistoryExternalId: string;
}
