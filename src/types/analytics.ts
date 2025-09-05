import {ISourceAnalytics} from "../models/SourceAnalyticsSchema";

/** ------------- API response types ------------- */

export interface GetSourceAnalyticsResponse {
    sourceAnalytics?: ISourceAnalytics[];
    totalSources?: number;
    error?: string;
}

export interface GetTopPerformingSourcesResponse {
    topSources?: ISourceAnalytics[];
    totalSources?: number;
    error?: string;
}

export interface UpdateSourceAnalyticsResponse {
    sourceAnalytics?: ISourceAnalytics;
    isUpdated?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface UpdateSourceAnalyticsParams {
    source: string;
    action: 'view' | 'bookmark' | 'complete' | 'unbookmark';
    readingTime?: number; // in seconds, for 'view' and 'complete' actions
}

export interface GetSourceAnalyticsParams {
    limit?: number;
    sortBy?: 'engagementScore' | 'totalViews' | 'bookmarkConversionRate' | 'completionRate';
    sortOrder?: 'asc' | 'desc';
}

export interface GetTopPerformingSourcesParams {
    limit?: number;
    minViews?: number; // Minimum views to be considered for top sources
}


/** ------------- analytics calculation helpers ------------- */

export interface EngagementScoreWeights {
    viewWeight: number;          // Default: 1
    bookmarkWeight: number;      // Default: 3
    completionWeight: number;    // Default: 2
    readingTimeWeight: number;   // Default: 0.1 (per minute)
}
