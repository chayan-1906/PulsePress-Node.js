export type SummarizationStyle = 'concise' | 'standard' | 'detailed';

/** ------------- API response types ------------- */

export interface SummarizeArticleResponse {
    summary?: string;
    powered_by?: string;
    error?: string;
}

export interface GenerateContentHashResponse {
    hash?: string;
    error?: string;
}

/** ------------- function params ------------- */

export interface SummarizeArticleParams {
    email: string;  // for authMiddleware
    content: string;
    language?: string;
    style?: SummarizationStyle;
}

export interface GenerateContentHashParams {
    content: string;
    language?: string;
    style?: SummarizationStyle;
}

export interface SaveSummaryToCacheParams {
    contentHash: string;
    summary: string;
    language?: string;
    style?: SummarizationStyle;
}

export interface GetCachedSummaryParams {
    contentHash: string;
}
