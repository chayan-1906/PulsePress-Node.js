export interface IRecommendedArticle {
    // Original article properties (from RSS or NewsAPI)
    source?: { name?: string; creator?: string } | { id?: string; name?: string };
    title?: string;
    url?: string;
    publishedAt?: string;
    content?: string;
    contentSnippet?: string;
    description?: string;
    urlToImage?: string;
    author?: string;
    categories?: string[];

    // Added recommendation properties
    recommendationScore: number;
    recommendationReason: string;
}


/** ------------- API response types ------------- */

export interface IGetContentRecommendationsResponse {
    recommendations?: IRecommendedArticle[];
    totalRecommendations?: number;
    error?: string;
}


/** ------------- function params ------------- */

export interface IGetContentRecommendationsParams {
    email: string;  // for authMiddleware
    pageSize?: number;
}
