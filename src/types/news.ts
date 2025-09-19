import {TSentimentResult} from "./ai";
import {COUNTRY_KEYWORDS, RSS_SOURCES, TOPIC_QUERIES} from "../utils/constants";

export const SUPPORTED_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology', 'country'];
export type TSupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const SUPPORTED_SOURCES: string[] = Object.values(RSS_SOURCES).flatMap(langSources => Object.keys(langSources));
export type TSupportedSource = string;

export const SUPPORTED_NEWS_LANGUAGES = ['english', 'bengali', 'hindi', 'multilingual'];
export type TSupportedNewsLanguage = typeof SUPPORTED_NEWS_LANGUAGES[number];

export const VALID_NYTIMES_SECTIONS = [
    'home', 'arts', 'automobiles', 'books', 'business', 'fashion', 'food', 'health',
    'insider', 'magazine', 'movies', 'nyregion', 'obituaries', 'opinion', 'politics',
    'realestate', 'science', 'sports', 'sundayreview', 'technology', 'theater',
    't-magazine', 'travel', 'upshot', 'us', 'world'
];
export type TValidNewYorkTimesSection = typeof VALID_NYTIMES_SECTIONS[number];

export type TTopic = keyof typeof TOPIC_QUERIES;
export type TCountry = keyof typeof COUNTRY_KEYWORDS;

export const ARTICLE_COMPLEXITIES = ['easy', 'medium', 'hard'];
export type TArticleComplexities = typeof ARTICLE_COMPLEXITIES[number];

export const PROCESSING_STATUSES = ['pending', 'completed', 'failed', 'cancelled'];
export type TProcessingStatus = typeof PROCESSING_STATUSES[number];

export const ENHANCEMENT_STATUSES = ['processing', 'complete', 'failed', 'cancelled'];
export type TEnhancementStatus = typeof ENHANCEMENT_STATUSES[number];


export const sourceMap: Record<string, TSupportedSource> = {
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
    'espn.com': 'espn',
    'rss.nytimes.com': 'nytWorld',
    'b2b.economictimes.indiatimes.com': 'b2bTopStories',

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

export interface IQualityScore {
    score: number; // 0-1, higher is better
    reasons: string[];
    isRelevant: boolean;
    isProfessional: boolean;
}

interface ISentimentData {
    sentiment: TSentimentResult;
    confidence: number;
    emoji: string;
    color: string;
}

export interface IArticle {
    source: {
        id: string | null;
        name: string | null;
    };
    author: string | null;
    articleId: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    urlToImage: string | null;
    publishedAt: string | null;
    content: string | null;
    qualityScore?: IQualityScore;
    sentimentData?: ISentimentData;
    complexity?: {
        level: TArticleComplexities;
        readingTimeMinutes: number;
        wordCount: number;
    };
    enhanced?: boolean;
}

export interface IRssFeed {
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

export interface IGuardianArticle {
    id: string;
    type: string;
    sectionId: string;
    sectionName: string;
    webPublicationDate: string;
    webTitle: string;
    webUrl: string;
    apiUrl: string;
    fields?: {
        headline?: string;
        byline?: string;
        thumbnail?: string;
        shortUrl?: string;
        bodyText?: string;
    };
}

export interface INewYorkTimesArticle {
    _id: string;
    web_url: string;
    snippet: string;
    lead_paragraph: string;
    abstract: string;
    print_page: number;
    source: string;
    multimedia: Array<{
        url: string;
        format: string;
        height: number;
        width: number;
        type: string;
        subtype: string;
        caption: string;
        copyright: string;
    }>;
    headline: {
        main: string;
        kicker?: string;
        content_kicker?: string;
        print_headline?: string;
        name?: string;
        seo?: string;
        sub?: string;
    };
    keywords: Array<{
        name: string;
        value: string;
        rank: number;
        major: string;
    }>;
    pub_date: string;
    document_type: string;
    news_desk: string;
    section_name: string;
    byline: {
        original: string;
        person: Array<{
            firstname: string;
            middlename?: string;
            lastname: string;
            qualifier?: string;
            title?: string;
            role: string;
            organization: string;
            rank: number;
        }>;
        organization?: string;
    };
    type_of_material: string;
    word_count: number;
}


/** ------------- API response types ------------- */

export interface INewsApiOrgTopHeadlinesAPIResponse {
    status: string;
    totalResults: number;
    articles: IArticle[];
}

export interface IGuardianResponse {
    response: {
        status: string;
        userTier: string;
        total: number;
        startIndex: number;
        pageSize: number;
        currentPage: number;
        pages: number;
        results: IGuardianArticle[];
    };
}

export interface INewYorkTimesSearchResponse {
    status: string;
    copyright: string;
    response: {
        docs: INewYorkTimesArticle[];
        metadata: {
            hits: number;
            offset: number;
            time: number;
        };
    };
}

export interface INewYorkTimesTopStoriesResponse {
    status: string;
    copyright: string;
    section: string;
    last_updated: string;
    num_results: number;
    results: Array<{
        section: string;
        subsection: string;
        title: string;
        abstract: string;
        url: string;
        uri: string;
        byline: string;
        item_type: string;
        updated_date: string;
        created_date: string;
        published_date: string;
        material_type_facet: string;
        kicker: string;
        des_facet: string[];
        org_facet: string[];
        per_facet: string[];
        geo_facet: string[];
        multimedia: Array<{
            url: string;
            format: string;
            height: number;
            width: number;
            type: string;
            subtype: string;
            caption: string;
            copyright: string;
        }>;
        short_url: string;
    }>;
}


/** ------------- function params ------------- */

export interface INewsApiOrgTopHeadlinesParams {
    country?: string;
    category?: string;
    sources?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface INewsApiOrgEverythingParams {
    sources?: string;
    from?: string;
    to?: string
    sortBy?: string
    language?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface IGuardianSearchParams {
    q?: string;
    section?: string;
    fromDate?: string;
    toDate?: string;
    orderBy?: string;
    pageSize?: number;
    page?: number;
}

export interface INewYorkTimesSearchParams {
    q?: string;
    section?: string;
    sort?: string;
    fromDate?: string;
    toDate?: string;
    pageSize?: number;
    page?: number;
}

export interface INewYorkTimesTopStoriesParams {
    section?: string;
}

export interface IRssFeedParams {
    q?: string;
    sources?: string;
    languages?: TSupportedNewsLanguage;
    pageSize?: number;
    page?: number;
}

export interface ISmartFetchWithVariationsParams {
    apiFunction: Function;
    query: string;
    params: any;
    minQualityResults?: number;
}

export interface IMultisourceFetchNewsParams {
    email?: string;  // for authMiddleware
    q?: string;
    category?: string;
    sources?: string;
    pageSize?: number;
    page?: number;
}

export interface IFetchMultisourceNewsEnhancementStatusParams {
    articleIds: string;
}

export interface IFetchArticleDetailsEnhancementStatusParams {
    articleId: string;
}

export interface IScrapeWebsiteParams {
    url?: string;
}

export interface IScrapeMultipleWebsitesParams {
    urls?: string[];
}

export interface IExploreTopicParams {
    email?: string;  // for authMiddleware
    country?: TCountry;
    page?: number;
    pageSize?: number;
}

export interface IGenerateArticleIdParams {
    article?: Partial<IArticle>;
    title?: string;
    url?: string;
}
