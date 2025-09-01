import {ISourceAnalytics} from "../models/SourceAnalyticsSchema";

/** ------------- API response types ------------- */

export interface IGetSourceAnalyticsResponse {
    sourceAnalytics?: ISourceAnalytics[];
    totalSources?: number;
    error?: string;
}

export interface IGetTopPerformingSourcesResponse {
    topSources?: ISourceAnalytics[];
    totalSources?: number;
    error?: string;
}

export interface IUpdateSourceAnalyticsResponse {
    sourceAnalytics?: ISourceAnalytics;
    isUpdated?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface IUpdateSourceAnalyticsParams {
    source: string;
    action: 'view' | 'bookmark' | 'complete' | 'unbookmark';
    readingTime?: number; // in seconds, for 'view' and 'complete' actions
}

export interface IGetSourceAnalyticsParams {
    limit?: number;
    sortBy?: 'engagementScore' | 'totalViews' | 'bookmarkConversionRate' | 'completionRate';
    sortOrder?: 'asc' | 'desc';
}

export interface IGetTopPerformingSourcesParams {
    limit?: number;
    minViews?: number; // Minimum views to be considered for top sources
}


/** ------------- analytics calculation helpers ------------- */

export interface IEngagementScoreWeights {
    viewWeight: number;          // Default: 1
    bookmarkWeight: number;      // Default: 3
    completionWeight: number;    // Default: 2
    readingTimeWeight: number;   // Default: 0.1 (per minute)
}
