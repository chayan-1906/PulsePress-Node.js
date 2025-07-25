import {RSS_SOURCES} from "../utils/constants";

export const SUPPORTED_CATEGORIES = [
    'business',
    'entertainment',
    'general',
    'health',
    'science',
    'sports',
    'technology',
] as const;
export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const SUPPORTED_SOURCES = Object.keys(RSS_SOURCES) as Array<keyof typeof RSS_SOURCES>;
export type SupportedSource = typeof SUPPORTED_SOURCES[number];

export const sourceMap: Record<string, SupportedSource> = {
    'techcrunch.com': 'techcrunch',
    'bbc.co.uk': 'bbc_tech',
    'wired.com': 'wired',
    'arstechnica.com': 'ars_technica',
    'engadget.com': 'engadget',
    'theverge.com': 'verge',
    'cnet.com': 'cnet',
    'mashable.com': 'mashable',
    'zdnet.com': 'zdnet',
    'techradar.com': 'techradar',
    'gizmodo.com': 'gizmodo',
    'news.ycombinator.com': 'hacker_news', // optional if needed
};

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
    pageSize?: number;
    page?: number;
}
