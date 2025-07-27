import {RSS_SOURCES} from "../utils/constants";

export const SUPPORTED_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology', 'country'];
export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const SUPPORTED_SOURCES: string[] = Object.values(RSS_SOURCES).flatMap(langSources => Object.keys(langSources));
export type SupportedSource = string;

export const SUPPORTED_NEWS_LANGUAGES = ['english', 'bengali', 'hindi'];
export type SupportedNewsLanguage = typeof SUPPORTED_NEWS_LANGUAGES[number];

export const sourceMap: Record<string, SupportedSource> = {
    // english
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
    'news.ycombinator.com': 'hacker_news',
    'timesofindia.indiatimes.com': 'timesofindia',

    // bengali
    'bartamanpatrika.com': 'bartaman',
    'sangbadpratidin.in': 'sangbad_pratidin',
    'prothomalo.com': 'prothom_alo',
    'kalerkantho.com': 'kaler_kantho',
    'bengali.oneindia.com': 'oneindia_bengali',
    'bengali.abplive.com': 'abp_live_home',

    // hindi
    'amarujala.com': 'amar_ujala_breaking',
    'hindi.oneindia.com': 'oneindia_hindi',
    'abplive.com': 'abp_live_home',
    'zeenews.india.com': 'zeenews_india',
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
    languages?: SupportedNewsLanguage;
    pageSize?: number;
    page?: number;
}

export interface ScrapeWebsiteParams {
    url?: string;
}

export interface ScrapeMultipleWebsitesParams {
    urls?: string[];
}
