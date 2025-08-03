import {RSS_SOURCES} from "../utils/constants";

export const SUPPORTED_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology', 'country'];
export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const SUPPORTED_SOURCES: string[] = Object.values(RSS_SOURCES).flatMap(langSources => Object.keys(langSources));
export type SupportedSource = string;

export const SUPPORTED_NEWS_LANGUAGES = ['english', 'bengali', 'hindi', 'multilingual'];
export type SupportedNewsLanguage = typeof SUPPORTED_NEWS_LANGUAGES[number];

export const sourceMap: Record<string, SupportedSource> = {
    // english
    'techcrunch.com': 'techcrunch',
    'feeds.bbci.co.uk': 'bbc_tech',
    'hnrss.org': 'hacker_news',
    'wired.com': 'wired',
    'feeds.arstechnica.com': 'ars_technica',
    'engadget.com': 'engadget',
    'theverge.com': 'verge',
    'cnet.com': 'cnet',
    'mashable.com': 'mashable',
    'zdnet.com': 'zdnet',
    'techradar.com': 'techradar',
    'gizmodo.com': 'gizmodo',
    'timesofindia.indiatimes.com': 'timesofindia_top',
    'feeds.feedburner.com': 'ndtv_top',
    'thehindu.com': 'the_hindu_india',
    'prod-qt-images.s3.amazonaws.com': 'prothom_alo_english',

    // bengali
    'prothomalo.com': 'prothom_alo',
    'bengali.oneindia.com': 'oneindia_bengali',
    'zeenews.india.com': 'zeenews_bengali', // Will need path-based handling for different languages
    'bengali.abplive.com': 'abp_live_bengali_home', // Will need path-based handling
    'bd24live.com': 'bd24live',
    'risingbd.com': 'risingbd',
    'bengali.news18.com': 'bengali_news_18',

    // hindi
    'amarujala.com': 'amar_ujala_breaking',
    'hindi.oneindia.com': 'oneindia_hindi',
    'abplive.com': 'abp_live_hindi_home',
};

export interface Article {
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

export interface FetchEverythingParams {
    sources?: string;
    from?: string;
    to?: string
    sortBy?: string
    language?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface ScrapeWebsiteParams {
    url?: string;
}

export interface ScrapeMultipleWebsitesParams {
    urls?: string[];
}
