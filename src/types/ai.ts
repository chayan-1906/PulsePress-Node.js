/** ------------- API response types ------------- */


/** ------------- function params ------------- */

export interface SummarizeArticleParams {
    email: string;  // for authMiddleware
    content: string;
    language?: string;
    style?: 'concise' | 'standard' | 'detailed';
}
