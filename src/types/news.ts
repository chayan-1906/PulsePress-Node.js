import {RSS_SOURCES} from "../utils/constants";

export const SUPPORTED_CATEGORIES = ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology', 'country'];
export type SupportedCategory = typeof SUPPORTED_CATEGORIES[number];

export const SUPPORTED_SOURCES: string[] = Object.values(RSS_SOURCES).flatMap(langSources => Object.keys(langSources));
export type SupportedSource = string;

export const SUPPORTED_NEWS_LANGUAGES = ['english', 'bengali', 'hindi', 'multilingual'];
export type SupportedNewsLanguage = typeof SUPPORTED_NEWS_LANGUAGES[number];

export const VALID_NYTIMES_SECTIONS = [
    'home', 'arts', 'automobiles', 'books', 'business', 'fashion', 'food', 'health',
    'insider', 'magazine', 'movies', 'nyregion', 'obituaries', 'opinion', 'politics',
    'realestate', 'science', 'sports', 'sundayreview', 'technology', 'theater',
    't-magazine', 'travel', 'upshot', 'us', 'world'
];
export type ValidNYTimesSection = typeof VALID_NYTIMES_SECTIONS[number];

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

// Content quality scoring interfaces
export interface QualityScore {
    score: number; // 0-1, higher is better
    reasons: string[];
    isRelevant: boolean;
    isProfessional: boolean;
}

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
    qualityScore?: QualityScore; // Added for quality assessment
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

export interface RSSSearchResult {
    item: RSSFeed;
    score: number;
    matches: readonly {
        indices: readonly number[][];
        value?: string;
        key?: string;
    }[];
}

export interface GuardianArticle {
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

export interface NYTimesArticle {
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

export interface NEWSORGTopHeadlinesAPIResponse {
    status: string;
    totalResults: number;
    articles: Article[];
}

export interface GuardianResponse {
    response: {
        status: string;
        userTier: string;
        total: number;
        startIndex: number;
        pageSize: number;
        currentPage: number;
        pages: number;
        results: GuardianArticle[];
    };
}

export interface NYTimesSearchResponse {
    status: string;
    copyright: string;
    response: {
        docs: NYTimesArticle[];
        metadata: {
            hits: number;
            offset: number;
            time: number;
        };
    };
}

export interface NYTimesTopStoriesResponse {
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

export interface NEWSORGTopHeadlinesParams {
    email?: string;
    country?: string;
    category?: string;
    sources?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface NEWSORGEverythingParams {
    email?: string;
    sources?: string;
    from?: string;
    to?: string
    sortBy?: string
    language?: string
    q?: string;
    pageSize?: number;
    page?: number;
}

export interface GuardianSearchParams {
    email?: string;
    q?: string;
    section?: string;
    fromDate?: string;
    toDate?: string;
    orderBy?: string;
    pageSize?: number;
    page?: number;
}

export interface NYTimesSearchParams {
    email?: string;
    q?: string;
    section?: string;
    sort?: string;
    fromDate?: string;
    toDate?: string;
    pageSize?: number;
    page?: number;
}

export interface NYTimesTopStoriesParams {
    email?: string;
    section?: string;
}

export interface RSSFeedParams {
    email?: string;
    q?: string;
    sources?: string;
    languages?: SupportedNewsLanguage;
    pageSize?: number;
    page?: number;
}

export interface MultisourceFetchNewsParams {
    email?: string;
    q?: string;
    category?: string;
    sources?: string;
    pageSize?: number;
    page?: number;
}

export interface ScrapeWebsiteParams {
    url?: string;
}

export interface ScrapeMultipleWebsitesParams {
    urls?: string[];
}
