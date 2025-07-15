interface Article {
    source: {
        id: string | null;
        name: string | null;
    };
    author: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    urlToImage: string | null;
    publishedAt: string | null;
    content: string | null;
}

export interface RSSFeed {
    source: {
        name: string | undefined;
        creator: string | undefined;
    }
    title: string | undefined;
    url: string | undefined;
    publishedAt: string | undefined;
    content: string | undefined;
    contentSnippet: string | undefined;
    categories: string[] | undefined;
    // comments: string;
    // guid: string;
    // isoDate: string;
}


/** ------------- API response types ------------- */

export interface TopHeadlinesAPIResponse {
    status: string;
    totalResults: number;
    articles: Article[];
}

/** ------------- function params ------------- */

export interface TopHeadlinesParams {
    country?: string;
    category?: string;
    sources?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface RSSFeedParams {
    sources?: string;
    page?: number;
}
