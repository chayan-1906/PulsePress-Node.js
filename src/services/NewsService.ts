import "colors";
import axios from "axios";
import Fuse from "fuse.js";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import AuthService from "./AuthService";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import {buildHeader} from "../utils/buildHeader";
import {generateArticleId} from "../utils/generateArticleId";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ArticleEnhancementService from "./ArticleEnhancementService";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {RSS_SOURCES, TOPIC_SPECIFIC_SOURCES, TRUSTED_NEWS_SOURCES, USER_AGENTS} from "../utils/constants";
import {GUARDIAN_API_KEY, GUARDIAN_QUOTA_REQUESTS, NEWSAPI_QUOTA_REQUESTS, NEWSAPIORG_QUOTA_MS, NODE_ENV, NYTIMES_API_KEY, NYTIMES_QUOTA_REQUESTS, RSS_CACHE_DURATION} from "../config/config";
import {
    IArticle,
    IGuardianArticle,
    IGuardianResponse,
    IGuardianSearchParams,
    IMultisourceFetchNewsParams,
    INewsAPIOrgEverythingParams,
    INewsAPIOrgTopHeadlinesAPIResponse,
    INewsAPIOrgTopHeadlinesParams,
    INYTimesArticle,
    INYTimesSearchParams,
    INYTimesSearchResponse,
    INYTimesTopStoriesParams,
    INYTimesTopStoriesResponse,
    IQualityScore,
    IRSSFeed,
    IRSSFeedParams,
    IScrapeMultipleWebsitesParams,
    IScrapeWebsiteParams,
    SUPPORTED_NEWS_LANGUAGES,
    TEnhancementStatus,
    VALID_NYTIMES_SECTIONS
} from "../types/news";

const RSS_CACHE = new Map<string, { data: IRSSFeed[], timestamp: number }>();
const TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
const EVERYTHING_NEWS_CACHE = new Map<string, { data: any, timestamp: number }>();
const GUARDIAN_CACHE = new Map<string, { data: any, timestamp: number }>();
const NYTIMES_CACHE = new Map<string, { data: any, timestamp: number }>();

let newsApiRequestCount = 0;
let guardianApiRequestCount = 0;
let nytimesApiRequestCount = 0;

setInterval(() => {
    newsApiRequestCount = 0;
    guardianApiRequestCount = 0;
    nytimesApiRequestCount = 0;
    console.log('Daily API counters reset'.blue);
}, Number.parseInt(NEWSAPIORG_QUOTA_MS!));

class NewsService {
    /**
     * Convert Guardian API response to standardized article format
     */
    private static convertGuardianToArticle(guardianArticle: IGuardianArticle): IArticle {
        console.log('Service: NewsService.convertGuardianToArticle called'.cyan.italic, {guardianArticle});

        const title = guardianArticle.fields?.headline || guardianArticle.webTitle;
        const url = guardianArticle.webUrl;
        const article: IArticle = {
            source: {
                id: 'guardian',
                name: 'The Guardian',
            },
            author: guardianArticle.fields?.byline || null,
            articleId: generateArticleId({title, url}),
            title,
            description: guardianArticle.fields?.bodyText?.substring(0, 100) + '...' || null,
            url,
            urlToImage: guardianArticle.fields?.thumbnail || null,
            publishedAt: guardianArticle.webPublicationDate,
            content: guardianArticle.fields?.bodyText?.substring(0, 100) + '...' || null,
        };
        console.log('convertGuardianToArticle:'.cyan, article);
        return article;
    }

    /**
     * Convert NY Times search API response to standardized article format
     */
    private static convertNYTimesToArticle(nytArticle: INYTimesArticle): IArticle {
        console.log('Service: NewsService.convertNYTimesToArticle called'.cyan.italic, {nytArticle});

        const title = nytArticle.headline?.main;
        const url = nytArticle.web_url;
        const article: IArticle = {
            source: {
                id: 'nytimes',
                name: 'The New York Times',
            },
            author: nytArticle.byline?.original || null,
            articleId: generateArticleId({title, url}),
            title,
            description: nytArticle.abstract || nytArticle.snippet || null,
            url,
            urlToImage: nytArticle.multimedia?.[0]?.url ? `https://static01.nyt.com/${nytArticle.multimedia[0].url}` : null,
            publishedAt: nytArticle.pub_date,
            content: nytArticle.lead_paragraph?.substring(0, 100) + '...' || null,
        };
        console.log('convertNYTimesToArticle:'.cyan, article);
        return article;
    }

    /**
     * Convert NY Times top stories API response to standardized article format
     */
    private static convertNYTimesTopStoryToArticle(story: INYTimesTopStoriesResponse['results'][0]): IArticle {
        console.log('Service: NewsService.convertNYTimesTopStoryToArticle called'.cyan.italic, {story});

        const title = story.title;
        const url = story.url;
        const article: IArticle = {
            source: {
                id: 'nytimes',
                name: 'The New York Times',
            },
            author: story.byline,
            articleId: generateArticleId({title, url}),
            title,
            description: story.abstract,
            url,
            urlToImage: story.multimedia?.[0]?.url || null,
            publishedAt: story.published_date,
            content: story.abstract?.substring(0, 100) + '...' || null,
        };
        console.log('convertNYTimesTopStoryToArticle:'.cyan, article);
        return article;
    }

    /**
     * Convert RSS feed item to standardized article format
     */
    private static convertRSSFeedToArticle(rss: IRSSFeed): IArticle {
        console.log('Service: NewsService.convertRSSFeedToArticle called'.cyan.italic, {rss});

        const title = rss.title || '';
        const url = rss.url || '';
        const article: IArticle = {
            source: {
                id: null,
                name: rss.source?.name || 'RSS Feed',
            },
            author: rss.source?.creator || null,
            articleId: generateArticleId({title, url}),
            title,
            description: rss.contentSnippet || null,
            url,
            urlToImage: null,
            publishedAt: rss.publishedAt || null,
            content: rss.content?.substring(0, 100) + '...' || null,
        };
        console.log('convertRSSFeedToArticle:'.cyan, article);
        return article;
    }

    /*
    * Workflow -
    * Original Query: "The latest news about the Trump administration policy"
    * Split by spaces using /\s+/: ["The", "latest", "news", "about", "the", "Trump", "administration", "policy"]
    * Filter out noise words, short words, and numbers ["latest", "news", "Trump", "administration", "policy"]
    * Create variations
      variations = [
        "The latest news about the Trump administration policy",  // Original
        "latest news Trump administration policy",                // No noise words
        "latest news Trump",                                      // First 3 words
        "latest news"                                             // First 2 words
      ]
    */
    /**
     * Generate query variations by removing noise words and creating shorter versions
     */
    private static generateQueryVariations(query: string): string[] {
        console.log('Service: NewsService.generateQueryVariations called'.cyan.italic, {query});

        if (!query) return [query];

        const noiseWords = [
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
            'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
        ];

        // Generic simplification approach
        const words = query.split(/\s+/).filter(word => word.length > 2 && !noiseWords.includes(word.toLowerCase()) && !/^\d+$/.test(word));

        const variations: string[] = [];

        // Original query
        variations.push(query);

        // Simplified version (remove noise words)
        if (words.length !== query.split(/\s+/).length) {
            variations.push(words.join(' '));
        }

        // Core keywords only (first 2-3 most important words)
        if (words.length > 3) {
            variations.push(words.slice(0, 3).join(' '));
            variations.push(words.slice(0, 2).join(' '));
        }

        return [...new Set(variations)];
    }

    /**
     * Simplify search query by taking the first variation
     */
    private static simplifySearchQuery(query: string): string {
        console.log('Service: NewsService.simplifySearchQuery called'.cyan.italic, {query});

        return this.generateQueryVariations(query)[0];
    }

    /**
     * Determine news topic/category from query text or explicit category
     */
    private static determineTopicFromQuery(query?: string, category?: string): string {
        console.log('Service: NewsService.determineTopicFromQuery called'.cyan.italic, {query, category});

        if (category) return category;

        if (!query) return 'general';

        const lowerQuery = query.toLowerCase();

        // Legacy fallback detection
        if (/sport|match|game|team|player|football|basketball|tennis|nba|cricket|soccer|olympics|athlete/i.test(lowerQuery)) return 'sports';
        if (/business|economy|market|finance|stock|trade|company|earnings|revenue|merger|ipo|startup/i.test(lowerQuery)) return 'business';
        if (/tech|technology|ai|software|digital|cyber|internet|app|gadget|robot|innovation |device/i.test(lowerQuery)) return 'technology';
        if (/health|medical|medicine|disease|treatment|doctor|covid|vaccine|hospital|mental |wellness|fitness|nutrition/i.test(lowerQuery)) return 'health';
        if (/science|research|study|climate|environment|space|nasa|discovery|biology|physics|astronomy|experiment/i.test(lowerQuery)) return 'science';
        if (/politics|government|election|policy|parliament|law|minister|president|senate|congress|diplomacy|campaign/i.test(lowerQuery)) return 'politics';
        if (/entertainment|movie|film|music|celebrity|actor|actress|hollywood|bollywood|show|tv|series|drama/i.test(lowerQuery)) return 'entertainment';
        if (/crime|arrest|police|court|trial|murder|investigation|lawsuit|theft|fraud|scam|homicide/i.test(lowerQuery)) return 'crime';
        if (/travel|tourism|flight|hotel|vacation|airline|destination|trip|journey|passport |visa/i.test(lowerQuery)) return 'travel';
        if (/education|school|university|college|student|exam|curriculum|learning|degree|tuition/i.test(lowerQuery)) return 'education';
        if (/weather|storm|rain|snow|heatwave|hurricane|flood|temperature|forecast/i.test(lowerQuery)) return 'weather';
        if (/auto|car|vehicle|automobile|ev|electric.vehicle|motor|tesla|ford|bmw|transport/i.test(lowerQuery)) return 'automotive';

        return 'general';
    }

    /**
     * Convert domain names to NewsAPI-compatible source format
     */
    private static convertDomainToNewsAPIFormat(sources: string): string {
        console.log('Service: NewsService.convertDomainToNewsAPIFormat called'.cyan.italic, {sources});

        const sourceMap: Record<string, string> = {
            // Business
            'bloomberg': 'bloomberg.com',
            'financial-times': 'financial-times.com',
            'wall-street-journal': 'the-wall-street-journal.com',
            'cnbc': 'cnbc.com',
            'business-insider': 'business-insider.com',
            'marketwatch': 'marketwatch.com',
            'fortune': 'fortune.com',
            'forbes': 'forbes.com',

            // Technology
            'techcrunch': 'techcrunch.com',
            'ars-technica': 'ars-technica.com',
            'the-verge': 'the-verge.com',
            'wired': 'wired.com',
            'engadget': 'engadget.com',
            'cnet': 'cnet.com',
            'zdnet': 'zdnet.com',
            'mashable': 'mashable.com',
            'gizmodo': 'gizmodo.com',
            'techradar': 'techradar.com',
            'recode': 'recode.net',
            'hacker-news': 'hacker-news.com',

            // Sports
            'espn': 'espn.com',
            'bbc-sport': 'bbc.co.uk',
            'sky-sports': 'sky-sports.com',
            'the-sport-bible': 'the-sport-bible.com',
            'talksport': 'talksport.com',
            'sporting-news': 'sporting-news.com',
            'sportsnet': 'sportsnet.ca',

            // General News
            'bbc-news': 'bbc.co.uk',
            'cnn': 'cnn.com',
            'reuters': 'reuters.com',
            'associated-press': 'associated-press.com',
            'al-jazeera': 'al-jazeera-english.com',
            'sky-news': 'sky-news.com',
            'washington-post': 'the-washington-post.com',
            'nytimes': 'the-new-york-times.com',
            'politico': 'politico.com',
            'the-hill': 'the-hill.com',
            'axios': 'axios.com',
            'usa-today': 'usa-today.com'
        };

        return sources.split(',').map(source => sourceMap[source.trim()] || source.trim()).join(',');
    }

    /**
     * Get topic-specific news sources or convert user-provided sources
     */
    private static getOptimizedSourcesForTopic(topic: string, userSources?: string): string | undefined {
        console.log('Service: NewsService.getOptimizedSourcesForTopic called'.cyan.italic, {topic, userSources});

        if (userSources) return this.convertDomainToNewsAPIFormat(userSources);

        const topicSources = TOPIC_SPECIFIC_SOURCES[topic as keyof typeof TOPIC_SPECIFIC_SOURCES];
        return topicSources ? this.convertDomainToNewsAPIFormat(topicSources.join(',')) : undefined;
    }

    /**
     * Map topic to NY Times API section parameter
     */
    private static mapToNYTimesSection(topic: string): string {
        console.log('Service: NewsService.mapToNYTimesSection called'.cyan.italic, {topic});

        const sectionMap: Record<string, string> = {
            sports: 'sports',
            business: 'business',
            technology: 'technology',
            health: 'health',
            science: 'science',
            politics: 'politics',
            general: 'home',
        };

        return sectionMap[topic] || 'home';
    }

    /**
     * Assess article quality based on source reliability, relevance, and content
     */
    private static assessContentQuality(article: IArticle, query?: string): IQualityScore {
        console.log('Service: NewsService.assessContentQuality called'.cyan.italic, {article, query});

        let score = 0.5;
        const reasons: string[] = [];
        let isRelevant = true;
        let isProfessional = true;

        const title = article.title?.toLowerCase() || '';
        const sourceName = article.source?.name?.toLowerCase() || '';

        const tier1Match = TRUSTED_NEWS_SOURCES.tier1.some(source => sourceName.includes(source.toLowerCase()));
        const tier2Match = TRUSTED_NEWS_SOURCES.tier2.some(source => sourceName.includes(source.toLowerCase()));
        const tier3Match = TRUSTED_NEWS_SOURCES.tier3.some(source => sourceName.includes(source.toLowerCase()));

        if (tier1Match) {
            score += 0.3;
            reasons.push('Tier 1 trusted source');
        } else if (tier2Match) {
            score += 0.2;
            reasons.push('Tier 2 reliable source');
        } else if (tier3Match) {
            score += 0.1;
            reasons.push('Tier 3 acceptable source');
        }

        if (title.length < 10) {
            score -= 0.2;
            reasons.push('Title too short');
        }

        if (!article.description || article.description.length < 30) {
            score -= 0.1;
            reasons.push('Missing or short description');
        }

        if (query) {
            const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
            const description = article.description?.toLowerCase() || '';

            const titleMatches = queryWords.filter(word => title.includes(word)).length;
            const descMatches = queryWords.filter(word => description.includes(word)).length;

            const totalMatches = titleMatches + (descMatches * 0.5);
            const relevance = Math.min(1.0, totalMatches / queryWords.length);

            if (relevance > 0.7) {
                score += 0.3;
                reasons.push('High relevance');
            } else if (relevance > 0.4) {
                score += 0.1;
                reasons.push('Good relevance');
            } else if (relevance > 0.2) {
                reasons.push('Medium relevance');
            } else if (relevance < 0.2) {
                score -= 0.3;
                isRelevant = false;
                reasons.push('Low relevance');
            }
        }

        const clickbaitPatterns = [/you won't believe/i, /shocking/i, /this will blow your mind/i, /number \d+ will surprise you/i, /one weird trick/i, /hate this/i, /must see/i, /amazing secret/i];

        if (clickbaitPatterns.some(pattern => pattern.test(title))) {
            score -= 0.4;
            isProfessional = false;
            reasons.push('Clickbait title');
        }

        return {
            score: Math.max(0, Math.min(1, score)),
            reasons,
            isRelevant,
            isProfessional,
        };
    }

    /**
     * Check if article is duplicate based on URL comparison
     */
    private static isDuplicateArticle(article: IArticle, existing: IArticle[]): boolean {
        console.log('Service: NewsService.isDuplicateArticle called'.cyan.italic, {article, existing});

        return existing.some(existingArticle => !!(article.url && existingArticle.url && article.url === existingArticle.url));
    }

    /**
     * Clean scraped text by removing extra whitespace and newlines
     */
    private static cleanScrapedText(text: string): string {
        console.log('Service: NewsService.cleanScrapedText called'.cyan.italic, {text});

        if (!text) return '';

        return text
            // Remove all types of newlines and replace with single space
            .replace(/\r\n|\r|\n/g, ' ')
            // Replace multiple spaces, tabs with single space
            .replace(/\s+/g, ' ')
            // Remove leading and trailing whitespace
            .trim();
    }

    /**
     * Fetch top headlines from NewsAPI.org with caching
     */
    static async fetchNewsAPIOrgTopHeadlines({country, category, sources, q, pageSize = 10, page = 1}: INewsAPIOrgTopHeadlinesParams) {
        console.log('Service: NewsService.fetchNewsAPIOrgTopHeadlines called'.cyan.italic, {country, category, sources, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsAPIOrgTopHeadlines processing query: "${q}"`.cyan);
                processedQuery = this.simplifySearchQuery(q.trim());
                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${country}-${category}-${sources}-${processedQuery}-${pageSize}-${page}`;
            const cached = TOPHEADLINES_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: NewsAPIOrg daily limit reached'.yellow);
                return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
            }

            const {data: topHeadlinesResponse} = await axios.get<INewsAPIOrgTopHeadlinesAPIResponse>(
                apis.topHeadlinesApi({country: country || 'us', category, sources, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            newsApiRequestCount++;
            console.log('External API: NewsAPIOrg TopHeadlines response'.magenta, topHeadlinesResponse);

            // Add articleId to each article
            if (topHeadlinesResponse.articles) {
                topHeadlinesResponse.articles = topHeadlinesResponse.articles.map((article: IArticle) => ({
                    ...article,
                    articleId: generateArticleId({article}),
                }));
            }

            if (NODE_ENV === 'production') {
                TOPHEADLINES_CACHE.set(cacheKey, {data: topHeadlinesResponse, timestamp: Date.now()});
            }

            return topHeadlinesResponse;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNewsAPIOrgTopHeadlines failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Fetch everything articles from NewsAPI.org with caching
     */
    static async fetchNewsAPIOrgEverything({sources, from, to, sortBy, language, q, pageSize = 10, page = 1}: INewsAPIOrgEverythingParams) {
        console.log('Service: NewsService.fetchNewsAPIOrgTopHeadlines called'.cyan.italic, {sources, from, to, sortBy, language, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsAPIOrgEverything processing query: "${q}"`.cyan);

                processedQuery = q.trim();

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${processedQuery}-${pageSize}-${page}`;
            const cached = EVERYTHING_NEWS_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
                console.log('NewsAPIOrg limit reached'.yellow);
                return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
            }

            const {data: everything} = await axios.get<INewsAPIOrgTopHeadlinesAPIResponse>(
                apis.fetchEverythingApi({sources, from, to, sortBy, language, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            newsApiRequestCount++;
            console.log('External API: NewsAPIOrg Everything response'.magenta, everything);

            if (everything.articles) {
                everything.articles = everything.articles.map((article: IArticle) => ({
                    ...article,
                    articleId: generateArticleId({article}),
                }));
            }

            if (NODE_ENV === 'production') {
                EVERYTHING_NEWS_CACHE.set(cacheKey, {data: everything, timestamp: Date.now()});
            }

            return everything;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNewsAPIOrgEverything failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Fetch news from Guardian API with caching
     */
    static async fetchGuardianNews({q, section, fromDate, toDate, orderBy = 'newest', pageSize = 10, page = 1}: IGuardianSearchParams) {
        console.log('Service: NewsService.fetchGuardianNews called'.cyan.italic, {q, section, fromDate, toDate, orderBy, pageSize, page});

        try {
            if (!GUARDIAN_API_KEY) {
                console.warn('Config Warning: Guardian API key not configured'.yellow.italic);
                return {articles: [], totalResults: 0};
            }

            if (guardianApiRequestCount >= Number.parseInt(GUARDIAN_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: Guardian API daily limit reached'.yellow);
                return {status: 'error', message: 'Guardian API daily limit reached', articles: [], totalResults: 0};
            }

            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchGuardianNews processing query: "${q}"`.cyan);

                processedQuery = this.simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `guardian-${processedQuery}-${section}-${fromDate}-${toDate}-${orderBy}-${pageSize}-${page}`;
            const cached = GUARDIAN_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                console.log('Cache: returning cached Guardian data'.cyan);
                return cached.data;
            }

            const url = apis.guardianSearchApi({q: processedQuery, section, fromDate, toDate, orderBy, pageSize, page}) + `&api-key=${GUARDIAN_API_KEY}`;
            const {data: guardianResponse} = await axios.get<IGuardianResponse>(url, {headers: buildHeader('guardian')});

            guardianApiRequestCount++;
            console.log(`External API: Guardian request ${guardianApiRequestCount}/${GUARDIAN_QUOTA_REQUESTS}:`.magenta, guardianResponse.response.total, 'results');

            const articles = guardianResponse.response.results.map(this.convertGuardianToArticle);
            const result = {
                articles,
                totalResults: guardianResponse.response.total,
                currentPage: guardianResponse.response.currentPage,
                pages: guardianResponse.response.pages,
            };

            if (NODE_ENV === 'production') {
                GUARDIAN_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchGuardianNews failed:'.red.bold, error.message);
            return {articles: [], totalResults: 0};
        }
    }

    /**
     * Fetch news from NY Times search API with caching
     */
    static async fetchNYTimesNews({q, section, sort = 'newest', fromDate, toDate, pageSize = 10, page = 1}: INYTimesSearchParams) {
        console.log('Service: NewsService.fetchNYTimesNews called'.cyan.italic, {q, section, sort, fromDate, toDate, pageSize, page});

        try {
            if (!NYTIMES_API_KEY) {
                console.warn('Config Warning: NYTimes API key not configured'.yellow.italic);
                return {articles: [], totalResults: 0};
            }

            if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
                console.warn('Client Error: Invalid nytimes section'.yellow, section);
                return {error: generateInvalidCode('nytimes_section')};
            }

            if (nytimesApiRequestCount >= Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: NYTimes API daily limit reached'.yellow);
                return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
            }

            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNYTimesNews processing query: "${q}"`.cyan);

                processedQuery = this.simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `nytimes-${processedQuery}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
            const cached = NYTIMES_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                console.log('Cache: returning cached NYTimes data'.cyan);
                return cached.data;
            }

            const url = apis.nytimesSearchApi({q: processedQuery, section, sort, fromDate, toDate, pageSize, page}) + `&api-key=${NYTIMES_API_KEY}`;
            const {data: nytResponse} = await axios.get<INYTimesSearchResponse>(url, {headers: buildHeader('nytimes')});
            console.log('Raw NYT search response:'.cyan, {
                status: nytResponse.status,
                hasResponse: !!nytResponse.response,
                hasDocs: !!nytResponse.response?.docs,
                docsLength: nytResponse.response?.docs?.length,
                metadata: nytResponse.response?.metadata,
            });

            nytimesApiRequestCount++;
            console.log(`External API: NYTimes request ${nytimesApiRequestCount}/${NYTIMES_QUOTA_REQUESTS}:`.magenta, nytResponse?.response?.metadata?.hits || 0, 'results');

            if (!nytResponse.response || !nytResponse.response.docs) {
                console.warn('Service Error: NYT API returned invalid response structure'.red.bold);
                return {articles: [], totalResults: 0};
            }

            const articles: IArticle[] = nytResponse.response.docs.map(this.convertNYTimesToArticle);
            const nytResponseMeta = nytResponse.response.metadata;
            const totalHits = nytResponseMeta?.hits || 0;

            const result = {
                articles: articles || [],
                totalResults: totalHits,
                currentPage: page,
                pages: Math.ceil(totalHits / pageSize),
            };

            if (NODE_ENV === 'production') {
                NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNYTimesNews failed:'.red.bold, error.message);
            return {articles: [], totalResults: 0};
        }
    }

    /**
     * Fetch top stories from NY Times API with caching
     */
    static async fetchNYTimesTopStories({section = 'home'}: INYTimesTopStoriesParams) {
        console.log('Service: NewsService.fetchNYTimesTopStories called'.cyan.italic, {section});

        try {
            if (!NYTIMES_API_KEY) {
                console.warn('Config Warning: NYTimes API key not configured'.yellow.italic);
                return {articles: [], totalResults: 0};
            }
            if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
                console.warn('Client Error: Invalid nytimes section'.yellow, section);
                return {error: generateInvalidCode('nytimes_section')};
            }

            if (nytimesApiRequestCount >= Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: NYTimes API daily limit reached'.yellow);
                return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
            }

            const cacheKey = `nytimes-top-${section}`;
            const cached = NYTIMES_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                console.log('Cache: returning cached NYTimes top stories'.cyan);
                return cached.data;
            }

            const url = apis.nytimesTopStoriesApi({section}) + `?api-key=${NYTIMES_API_KEY}`;
            const {data: nytResponse} = await axios.get<INYTimesTopStoriesResponse>(url, {headers: buildHeader('nytimes')});

            nytimesApiRequestCount++;
            console.log(`External API: NYTimes Top Stories request ${nytimesApiRequestCount}/${NYTIMES_QUOTA_REQUESTS}:`.magenta, nytResponse.num_results, 'results');

            const articles: IArticle[] = nytResponse.results?.map(this.convertNYTimesTopStoryToArticle);

            const result = {
                articles,
                totalResults: nytResponse.num_results,
                section: nytResponse.section,
                lastUpdated: nytResponse.last_updated,
            };

            if (NODE_ENV === 'production') {
                NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNYTimesTopStories failed:'.red.bold, error.message);
            return {articles: [], totalResults: 0};
        }
    }

    /**
     * Fetch and search RSS feeds from multiple sources with fuzzy matching
     */
    static async fetchAllRSSFeeds({q, sources, languages = 'english', pageSize = 10, page = 1}: IRSSFeedParams) {
        console.log('Service: NewsService.fetchAllRSSFeeds called'.cyan.italic, {q, sources, languages, pageSize, page});

        try {
            const cacheKey = `${q}-${sources}-${languages}-${pageSize}-${page}`;
            const cached = RSS_CACHE.get(cacheKey);

            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
                return cached.data;
            }

            const languageList = languages
                ? languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
                : [];

            const validLanguages = languageList.filter(lang => SUPPORTED_NEWS_LANGUAGES.includes(lang));
            const languagesToFetch = validLanguages.length ? validLanguages : ['english', 'multilingual'];

            let inputSources: string[] = [];

            if (sources) {
                inputSources = sources.split(',').map(s => s.trim()).filter(Boolean);
            }

            const seenURLs = new Set<string>();
            const promises: Promise<any>[] = [];

            languagesToFetch.forEach(language => {
                const languageSources = RSS_SOURCES[language as keyof typeof RSS_SOURCES];
                const availableSources = Object.keys(languageSources);

                const selectedSources = inputSources.length
                    ? inputSources.filter(src => src in languageSources)
                    : [...availableSources].sort(() => Math.random() - 0.5);

                selectedSources.forEach(source => {
                    const url = languageSources[source as keyof typeof languageSources];
                    if (url && !seenURLs.has(url)) {
                        seenURLs.add(url);
                        promises.push(parseRSS(url).catch(() => null));
                    }
                });
            });

            const results = await Promise.allSettled(promises);
            const allItems = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .flatMap(r => (r as PromiseFulfilledResult<IRSSFeed[]>).value)
                .sort((a: IRSSFeed, b: IRSSFeed) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

            if (q && q.trim()) {
                console.log(`Service: fetchAllRSSFeeds searching for: "${q}"`.cyan);

                const simplifiedQuery = this.simplifySearchQuery(q.trim());
                const expandedTerms = simplifiedQuery.split(' ').filter(term => term.length > 2);

                const fuse = new Fuse(allItems, {
                    keys: [
                        {name: 'title', weight: 0.7},
                        {name: 'contentSnippet', weight: 0.3},
                        {name: 'categories', weight: 0.2},
                    ],
                    threshold: 0.4,
                    includeScore: true,
                    includeMatches: true,
                    minMatchCharLength: 3,
                    ignoreLocation: true,
                });

                const allResults = new Map<string, { item: IRSSFeed, score: number }>();
                expandedTerms.forEach((term, index) => {
                    const termResults = fuse.search(term);
                    const weight = index === 0 ? 1.0 : 0.7;

                    termResults.forEach(result => {
                        const url = result.item.url;
                        if (url) {
                            const score = (1 - (result.score || 0)) * weight;
                            if (!allResults.has(url) || allResults.get(url)!.score < score) {
                                allResults.set(url, {item: result.item, score});
                            }
                        }
                    });
                });

                const searchResults = Array.from(allResults.values()).sort((a, b) => {
                    if (Math.abs(a.score - b.score) > 0.1) {
                        return b.score - a.score;
                    }
                    // If scores close, prefer newer articles
                    const dateA = a.item.publishedAt ? new Date(a.item.publishedAt).getTime() : 0;
                    const dateB = b.item.publishedAt ? new Date(b.item.publishedAt).getTime() : 0;
                    return dateB - dateA;
                });

                const startIndex = (page - 1) * pageSize;
                const paginatedResults = searchResults.slice(startIndex, startIndex + pageSize);
                const finalResults = paginatedResults.map(r => r.item);

                console.log(`RSS search completed: found ${searchResults.length} results for "${q}"`.green.bold);

                if (NODE_ENV === 'production') {
                    RSS_CACHE.set(cacheKey, {data: finalResults, timestamp: Date.now()});
                }

                return finalResults;
            }

            const startIndex = (page - 1) * pageSize;
            const paginatedResults = allItems.slice(startIndex, startIndex + pageSize);

            if (NODE_ENV === 'production') {
                RSS_CACHE.set(cacheKey, {data: paginatedResults, timestamp: Date.now()});
            }

            return paginatedResults;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchAllRSSFeeds failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Smart fetch with query variations and quality filtering
     */
    private static async smartFetchWithVariations(apiFunction: Function, query: string, params: any, minQualityResults: number = 3): Promise<any> {
        console.log('Service: NewsService.smartFetchWithVariations called'.cyan.italic, {query, params, minQualityResults});

        const queryVariations = this.generateQueryVariations(query);
        console.log(`Service: smartFetchWithVariations trying ${queryVariations.length} query variations:`, queryVariations);

        for (let i = 0; i < queryVariations.length; i++) {
            const variation = queryVariations[i];
            console.log(`Attempt ${i + 1}: "${variation}"`.cyan);

            try {
                const result = await apiFunction({...params, q: variation});

                if (result && result.articles && result.articles.length > 0) {
                    // Apply quality scoring and filtering
                    const qualityArticles = result.articles
                        .map((article: IArticle) => {
                            article.qualityScore = this.assessContentQuality(article, query); // Use original query for relevance
                            return article;
                        })
                        .filter((article: IArticle) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.4);

                    console.log(`Query variation "${variation}" yielded ${qualityArticles.length} quality articles (from ${result.articles.length} total)`.cyan);

                    if (qualityArticles.length >= minQualityResults) {
                        return {
                            ...result,
                            articles: qualityArticles,
                            usedQuery: variation,
                            originalQuery: query,
                        };
                    }
                }
            } catch (error: any) {
                console.log(`Service Error: Query variation "${variation}" failed:`.red.bold, error.message);
            }
        }

        console.warn(`Service Warning: All query variations failed to produce ${minQualityResults}+ quality results`.yellow);
        return null;
    }

    /**
     * Fetch news from multiple sources with quality scoring and sentiment analysis
     */
    static async fetchMultiSourceNews({email, q, category, sources, pageSize = 10, page = 1}: IMultisourceFetchNewsParams) {
        console.log('Service: fetchMultiSourceNews called'.cyan.italic, {q, category, sources, pageSize, page});

        const topic = this.determineTopicFromQuery(q, category);
        const simplifiedQuery = q ? this.simplifySearchQuery(q) : q;
        const optimizedSources = this.getOptimizedSourcesForTopic(topic, sources);
        const nytSection = this.mapToNYTimesSection(topic);

        console.log('Topic:'.cyan, topic);
        console.log('Simplified query:'.cyan, simplifiedQuery);
        console.log('Optimized sources:'.cyan, optimizedSources);
        console.log('NYT section:'.cyan, nytSection);

        const results: IArticle[] = [];
        const usedSources: string[] = [];
        const errors: string[] = [];

        // NewsAPIOrg (40% of requested articles) with smart query variations
        const newsApiTargetCount = Math.ceil(pageSize * 0.4);
        try {
            if (newsApiRequestCount < Number.parseInt(NEWSAPI_QUOTA_REQUESTS!) && simplifiedQuery) {
                console.log(`Service: Trying NewsAPIOrg with smart query variations (target: ${newsApiTargetCount} articles)...`.cyan);

                const newsApiResult = await this.smartFetchWithVariations(
                    this.fetchNewsAPIOrgEverything,
                    simplifiedQuery,
                    {language: 'en', sortBy: 'relevancy', pageSize: newsApiTargetCount * 3, page},
                    Math.max(2, Math.ceil(newsApiTargetCount / 2)),
                );

                if (newsApiResult && newsApiResult.articles && newsApiResult.articles.length > 0) {
                    const topArticles = newsApiResult.articles
                        .sort((a: IArticle, b: IArticle) => b.qualityScore!.score - a.qualityScore!.score)
                        .slice(0, newsApiTargetCount);

                    results.push(...topArticles);
                    usedSources.push(`NewsAPI (${newsApiResult.usedQuery})`);
                    console.log(`NewsAPI contributed ${topArticles.length} quality articles using query: "${newsApiResult.usedQuery}"`.cyan);
                } else {
                    console.warn('Service Warning: NewsAPIOrg smart fetch returned no quality articles'.yellow);

                    const fallbackResult = await this.fetchNewsAPIOrgTopHeadlines({
                        country: 'us',
                        category: topic !== 'general' ? topic : undefined,
                        sources: optimizedSources,
                        pageSize: newsApiTargetCount,
                        page,
                    });

                    if (fallbackResult && fallbackResult.articles && fallbackResult.articles.length > 0) {
                        results.push(...fallbackResult.articles.slice(0, newsApiTargetCount));
                        usedSources.push('NewsAPI (fallback)');
                        console.log(`NewsAPI fallback contributed ${Math.min(fallbackResult.articles.length, newsApiTargetCount)} articles`.cyan);
                    }
                }
            } else if (!simplifiedQuery) {
                const headlinesResult = await this.fetchNewsAPIOrgTopHeadlines({
                    country: 'us',
                    category: topic !== 'general' ? topic : undefined,
                    sources: optimizedSources,
                    pageSize: newsApiTargetCount,
                    page,
                });

                if (headlinesResult && headlinesResult.articles && headlinesResult.articles.length > 0) {
                    results.push(...headlinesResult.articles.slice(0, newsApiTargetCount));
                    usedSources.push('NewsAPI (headlines)');
                    console.log(`NewsAPI headlines contributed ${Math.min(headlinesResult.articles.length, newsApiTargetCount)} articles`.cyan);
                }
            } else {
                errors.push('NewsAPIOrg limit reached');
                console.warn('Rate Limit: NewsAPI limit reached, skipping...'.yellow);
            }
        } catch (error: any) {
            errors.push(`NewsAPIOrg failed: ${error.message}`);
            console.warn('Service Warning: NewsAPIOrg failed, continuing...'.yellow, error.message);
        }

        // Guardian API (40% of remaining slots)
        const remainingSlots = pageSize - results.length;
        const guardianTargetCount = Math.ceil(remainingSlots * 0.4);

        if (remainingSlots > 0) {
            try {
                if (guardianApiRequestCount < Number.parseInt(GUARDIAN_QUOTA_REQUESTS!) && simplifiedQuery) {
                    console.log(`Service: Trying Guardian API with smart variations (target: ${guardianTargetCount} articles)...`.cyan);

                    const guardianResult = await this.smartFetchWithVariations(
                        this.fetchGuardianNews,
                        simplifiedQuery,
                        {section: topic !== 'general' ? topic : undefined, orderBy: 'relevance', pageSize: guardianTargetCount * 3, page},
                        Math.max(1, Math.ceil(guardianTargetCount / 3)) // Need at least 1 good result
                    );

                    if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                        const qualityArticles = guardianResult.articles
                            .filter((article: IArticle) => !this.isDuplicateArticle(article, results))
                            .sort((a: IArticle, b: IArticle) => b.qualityScore!.score - a.qualityScore!.score)
                            .slice(0, guardianTargetCount);

                        results.push(...qualityArticles);
                        usedSources.push(`Guardian (${guardianResult.usedQuery})`);
                        console.log(`Guardian contributed ${qualityArticles.length} quality articles using query: "${guardianResult.usedQuery}"`.cyan);
                    }
                } else if (!simplifiedQuery) {
                    const guardianResult = await this.fetchGuardianNews({
                        section: topic !== 'general' ? topic : undefined,
                        orderBy: 'newest',
                        pageSize: guardianTargetCount,
                        page,
                    });

                    if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                        const articles = guardianResult.articles
                            .filter((article: IArticle) => !this.isDuplicateArticle(article, results))
                            .slice(0, guardianTargetCount);
                        results.push(...articles);
                        usedSources.push('Guardian (section)');
                        console.log(`Guardian section contributed ${articles.length} articles`.cyan);
                    }
                } else {
                    errors.push('Guardian API limit reached');
                    console.warn('Rate Limit: Guardian API limit reached, skipping...'.yellow);
                }
            } catch (error: any) {
                errors.push(`Guardian failed: ${error.message}`);
                console.warn('Service Warning: Guardian API failed, continuing...'.yellow);
            }
        }

        // NYTimes API (30% of remaining slots)
        const remainingSlots2 = pageSize - results.length;
        const nytimesTargetCount = Math.ceil(remainingSlots2 * 0.3);

        if (remainingSlots2 > 0) {
            try {
                if (nytimesApiRequestCount < Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
                    console.log(`Service: Trying NYTimes API (target: ${nytimesTargetCount} articles)...`.cyan);

                    if (simplifiedQuery) {
                        const nytResult = await this.smartFetchWithVariations(
                            this.fetchNYTimesNews,
                            simplifiedQuery,
                            {section: nytSection, sort: 'relevance', pageSize: nytimesTargetCount * 3, page},
                            Math.max(1, Math.ceil(nytimesTargetCount / 3)) // Need at least 1 good result
                        );

                        if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                            const qualityArticles = nytResult.articles
                                .filter((article: IArticle) => !this.isDuplicateArticle(article, results))
                                .sort((a: IArticle, b: IArticle) => b.qualityScore!.score - a.qualityScore!.score)
                                .slice(0, nytimesTargetCount);

                            results.push(...qualityArticles);
                            usedSources.push(`NYTimes (${nytResult.usedQuery})`);
                            console.log(`NYTimes contributed ${qualityArticles.length} quality articles using query: "${nytResult.usedQuery}"`.cyan);
                        }
                    } else {
                        const nytResult = await this.fetchNYTimesTopStories({section: nytSection});

                        if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                            const articles = nytResult.articles
                                .filter((article: IArticle) => !this.isDuplicateArticle(article, results))
                                .slice(0, nytimesTargetCount);
                            results.push(...articles);
                            usedSources.push('NYTimes (top stories)');
                            console.log(`NYTimes top stories contributed ${articles.length} articles`.cyan);
                        }
                    }
                } else {
                    errors.push('NYTimes API limit reached');
                    console.warn('Rate Limit: NYTimes API limit reached, skipping...'.yellow);
                }
            } catch (error: any) {
                errors.push(`NYTimes failed: ${error.message}`);
                console.warn('Service Warning: NYTimes API failed, continuing...'.yellow);
            }
        }

        // RSS feeds (fill remaining)
        const remainingSlots3 = pageSize - results.length;

        if (remainingSlots3 > 0) {
            try {
                console.log(`Service: Trying RSS feeds (target: ${remainingSlots3} articles)...`.cyan);

                const rssResults = await this.fetchAllRSSFeeds({q: simplifiedQuery, sources: optimizedSources, pageSize: remainingSlots3 * 2, page});

                if (rssResults && rssResults.length > 0) {
                    const rssArticles = rssResults.map(this.convertRSSFeedToArticle);

                    const qualityArticles = rssArticles
                        .map(article => {
                            article.qualityScore = this.assessContentQuality(article, q);
                            return article;
                        })
                        .filter((article: IArticle) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.2 && !this.isDuplicateArticle(article, results))
                        .sort((a, b) => b.qualityScore!.score - a.qualityScore!.score)
                        .slice(0, remainingSlots3);

                    results.push(...qualityArticles);
                    usedSources.push('RSS');
                    console.log(`RSS contributed ${qualityArticles.length} quality articles (filtered from ${rssArticles.length})`.cyan);
                }
            } catch (error: any) {
                errors.push(`RSS failed: ${error.message}`);
                console.warn('Service Warning: RSS fallback failed, continuing...'.yellow);
            }
        }

        const finalResults = results.sort((a: IArticle, b: IArticle) => {
            // Primary sort: Quality score
            const scoreDiff = (b.qualityScore?.score || 0) - (a.qualityScore?.score || 0);
            if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

            // Secondary sort: Recency for similar scores
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        }).slice(0, pageSize);

        console.log(`Multisource search completed successfully: ${finalResults.length}/${pageSize} quality articles from [${usedSources.join(', ')}]`.green.bold);

        // Enrich articles with sentiment analysis for logged-in users
        let enrichedArticles = finalResults;
        let sentimentAnalysisEnabled = false;

        if (email) {
            try {
                // Verify user exists
                const {user} = await AuthService.getUserByEmail({email});
                if (user) {
                    console.log('User verified, enriching articles with sentiment analysis...'.cyan);
                    console.time('Performance: MULTISOURCE_SENTIMENT_ENRICHMENT_TIME'.cyan);
                    enrichedArticles = await SentimentAnalysisService.enrichArticlesWithSentiment(finalResults, true);
                    console.timeEnd('Performance: MULTISOURCE_SENTIMENT_ENRICHMENT_TIME'.cyan);
                    sentimentAnalysisEnabled = true;
                } else {
                    console.warn('Service Warning: User not found, skipping sentiment analysis'.yellow);
                }
            } catch (error: any) {
                console.error('ERROR: during user verification or sentiment analysis:'.red.bold, error.message);
                // Continue without sentiment analysis if there's an error
            }
        }

        return {
            totalResults: enrichedArticles.length,
            query: q,
            articles: enrichedArticles,
            sentimentAnalysisEnabled,
            metadata: {
                usedSources,
                errors: errors.length > 0 ? errors : undefined,
                apiRequestCounts: {
                    newsApi: newsApiRequestCount,
                    guardian: guardianApiRequestCount,
                    nytimes: nytimesApiRequestCount,
                },
            },
        };
    }

    /**
     * Scrape article content from URL using Readability
     */
    private static async scrapeArticle({url}: IScrapeWebsiteParams) {
        console.log('Service: scrapeArticle called'.cyan.italic, url);

        try {
            if (!url) {
                return {error: generateMissingCode('url')};
            }

            let response: any;
            for (const userAgent of USER_AGENTS) {
                try {
                    response = await axios.get(url, {
                        headers: buildHeader('webscraping', userAgent),
                        timeout: 10000,
                    });
                    break; // Success - exit loop
                } catch (error) {
                    if (userAgent === USER_AGENTS[USER_AGENTS.length - 1]) {
                        throw error; // Last attempt failed
                    }
                    // continue; // Try next user agent
                }
            }

            const virtualConsole = new VirtualConsole();
            virtualConsole.on('error', () => {
            });
            virtualConsole.on('warn', () => {
            });

            const dom = new JSDOM(response.data, {
                url,
                virtualConsole,
                pretendToBeVisual: false,
                resources: 'usable',
            });

            const reader = new Readability(dom.window.document);
            const article = reader.parse();
            console.log('Article parsed successfully:'.cyan, article);

            if (!article) {
                throw new Error('Failed to parse article content');
            }

            const cleanedContent = this.cleanScrapedText(article.textContent || '');

            return {
                url,
                title: this.cleanScrapedText(article.title || ''),
                content: cleanedContent,
                excerpt: this.cleanScrapedText(article.excerpt || ''),
                byline: this.cleanScrapedText(article.byline || ''),
                length: cleanedContent.length,
                readingTimeMinutes: Math.ceil(cleanedContent.length / 200),
                timestamp: new Date().toISOString(),
                method: 'readability',
                status: 200,
            };
        } catch (error: any) {
            console.error('Service Error: NewsService.scrapeArticle failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Scrape content from multiple URLs with error handling
     */
    static async scrapeMultipleArticles({urls}: IScrapeMultipleWebsitesParams) {
        console.log('Service: NewsService.scrapeMultipleArticles called'.cyan.italic, {urls});

        const results = [];

        if (isListEmpty(urls)) {
            return [];
        }

        const isValidUrl = (url: string) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }

        for (const url of urls.filter(isValidUrl)) {
            try {
                const article = await this.scrapeArticle({url});
                results.push(article);
            } catch (error: any) {
                results.push({
                    url,
                    status: error.status,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        }

        return results;
    }

    /**
     * Fast multi-source news fetch with parallel API calls and simple deduplication
     */
    private static async fetchMultiSourceNewsFast({email, q, category, sources, pageSize = 10, page = 1}: IMultisourceFetchNewsParams) {
        console.log('Service: fetchMultiSourceNewsFast called'.cyan.italic, {q, category, sources, pageSize, page});

        const startTime = Date.now();
        const topic = this.determineTopicFromQuery(q, category);
        const simplifiedQuery = q ? this.simplifySearchQuery(q) : q;
        const optimizedSources = this.getOptimizedSourcesForTopic(topic, sources);

        console.log('Topic:'.cyan, topic);
        console.log('Simplified query:'.cyan, simplifiedQuery);

        const results: IArticle[] = [];
        const usedSources: string[] = [];
        const errors: string[] = [];

        // Simplified approach - parallel API calls, no quality scoring
        const apiPromises = [];

        // NewsAPI (10% of articles)
        const newsApiCount = Math.ceil(pageSize * 0.1);
        if (newsApiRequestCount < Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
            if (simplifiedQuery) {
                apiPromises.push(
                    this.fetchNewsAPIOrgEverything({
                        q: simplifiedQuery,
                        language: 'en',
                        sortBy: 'relevancy',
                        pageSize: newsApiCount,
                        page,
                    }).then(result => ({source: 'NewsAPI-Search', result}))
                        .catch(err => ({source: 'NewsAPI-Search', error: err.message}))
                );
            } else {
                apiPromises.push(
                    this.fetchNewsAPIOrgTopHeadlines({
                        country: 'us',
                        category: topic !== 'general' ? topic : undefined,
                        sources: optimizedSources,
                        pageSize: newsApiCount,
                        page,
                    }).then(result => ({source: 'NewsAPI-Headlines', result}))
                        .catch(err => ({source: 'NewsAPI-Headlines', error: err.message}))
                );
            }
        }

        // Guardian (30% of articles)
        const guardianCount = Math.ceil(pageSize * 0.3);
        if (guardianApiRequestCount < Number.parseInt(GUARDIAN_QUOTA_REQUESTS!)) {
            apiPromises.push(
                this.fetchGuardianNews({
                    q: simplifiedQuery,
                    section: topic !== 'general' ? topic : undefined,
                    orderBy: 'newest',
                    pageSize: guardianCount,
                    page,
                }).then(result => ({source: 'Guardian', result}))
                    .catch(err => ({source: 'Guardian', error: err.message}))
            );
        }

        // NYTimes (20% of articles)
        const nytimesCount = Math.ceil(pageSize * 0.2);
        const nytSection = this.mapToNYTimesSection(topic);
        if (nytimesApiRequestCount < Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
            if (simplifiedQuery) {
                apiPromises.push(
                    this.fetchNYTimesNews({
                        q: simplifiedQuery,
                        section: nytSection,
                        sort: 'newest',
                        pageSize: nytimesCount,
                        page,
                    }).then(result => ({source: 'NYTimes-Search', result}))
                        .catch(err => ({source: 'NYTimes-Search', error: err.message}))
                );
            } else {
                apiPromises.push(
                    this.fetchNYTimesTopStories({section: nytSection})
                        .then(result => {
                            // Limit results to desired count for consistency
                            const limitedResult = {
                                ...result,
                                articles: result.articles?.slice(0, nytimesCount) || []
                            };
                            return {source: 'NYTimes-TopStories', result: limitedResult};
                        }).catch(err => ({source: 'NYTimes-TopStories', error: err.message}))
                );
            }
        }

        // RSS (40% of articles)
        const rssCount = Math.ceil(pageSize * 0.4);
        apiPromises.push(this.fetchAllRSSFeeds({
                q: simplifiedQuery,
                sources: optimizedSources,
                pageSize: rssCount,
                page,
            }).then(rssResults => {
                const articles = rssResults.map(this.convertRSSFeedToArticle);
                return {source: 'RSS', result: {articles}};
            }).catch((error: any) => ({source: 'RSS', error: error.message}))
        );

        // Execute all API calls in parallel
        const apiResults = await Promise.allSettled(apiPromises);
        apiResults.forEach((promiseResult) => {
            if (promiseResult.status === 'fulfilled') {
                const apiResult = promiseResult.value;

                if ('error' in apiResult) {
                    errors.push(`${apiResult.source}: ${apiResult.error}`);
                    console.warn(`Service Warning: ${apiResult.source} failed:`.yellow, apiResult.error);
                } else if (apiResult.result && apiResult.result.articles && apiResult.result.articles.length > 0) {
                    // Simple deduplication by URL and tag with source API
                    const newArticles = apiResult.result.articles
                        .filter((article: IArticle) =>
                            article.url && !results.some(existing => existing.url === article.url)
                        )
                        .map((article: IArticle) => ({
                            ...article,
                            sourceApi: apiResult.source // Tag each article with the API source
                        }));

                    results.push(...newArticles);
                    usedSources.push(apiResult.source);
                    console.log(`${apiResult.source} contributed ${newArticles.length} articles`.cyan);
                }
            }
        });

        // Simple sorting by publication date (newest first)
        const sortedResults = results
            .filter(article => article.title && article.url)
            .sort((a, b) => {
                const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
                const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, pageSize);

        const loadTime = Date.now() - startTime;

        const distribution = {
            'NewsAPI-Search': 0,
            'NewsAPI-Headlines': 0,
            'Guardian': 0,
            'NYTimes-Search': 0,
            'NYTimes-TopStories': 0,
            'RSS': 0
        };

        sortedResults.forEach(article => {
            const sourceApi = (article as any).sourceApi;
            if (sourceApi && distribution.hasOwnProperty(sourceApi)) {
                distribution[sourceApi as keyof typeof distribution]++;
            }
        });

        const newsApiTotal = distribution['NewsAPI-Search'] + distribution['NewsAPI-Headlines'];
        const nytimesTotal = distribution['NYTimes-Search'] + distribution['NYTimes-TopStories'];

        console.log(`Fast multisource news fetch completed successfully: ${sortedResults.length} articles in ${loadTime}ms from [${usedSources.join(', ')}]`.green.bold);
        console.log(`Actual distribution: NewsAPI(${newsApiTotal}), Guardian(${distribution.Guardian}), NYTimes(${nytimesTotal}), RSS(${distribution.RSS})`.green.bold);
        console.log(`Target ratios: NewsAPI(10%), Guardian(30%), NYTimes(20%), RSS(40%)`.green.bold);

        // Start background enhancement (fire and forget)
        if (sortedResults.length > 0) {
            ArticleEnhancementService.enhanceArticlesInBackground({email: email || '', articles: sortedResults}).then(r => {
            });
        }

        return {
            totalResults: sortedResults.length,
            query: q,
            articles: sortedResults,
            loadTime: `${loadTime}ms`,
            metadata: {
                usedSources,
                errors: errors.length > 0 ? errors : undefined,
                enhanced: false,
                distribution: {
                    newsApi: newsApiTotal,
                    guardian: distribution.Guardian,
                    nytimes: nytimesTotal,
                    rss: distribution.RSS,
                    total: sortedResults.length,
                },
                targetRatios: {
                    newsApi: '10%',
                    guardian: '30%',
                    nytimes: '20%',
                    rss: '40%',
                },
                apiRequestCounts: {
                    newsApi: newsApiRequestCount,
                    guardian: guardianApiRequestCount,
                    nytimes: nytimesApiRequestCount,
                },
            },
        };
    }

    /**
     * Enhanced multi-source news fetch with AI enhancements and progressive loading
     */
    static async fetchMultiSourceNewsEnhanced({email, q, category, sources, pageSize = 10, page = 1}: IMultisourceFetchNewsParams) {
        console.log('Service: fetchMultiSourceNewsEnhanced called'.cyan.italic, {q, category, sources, pageSize, page});

        const startTime = Date.now();

        const fastResults = await this.fetchMultiSourceNewsFast({email, q, category, sources, pageSize, page});

        console.time('Performance: ENHANCEMENT_CHECK_TIME'.cyan);
        const existingEnhancements = await ArticleEnhancementService.getEnhancementsForArticles({articles: fastResults.articles});
        console.timeEnd('Performance: ENHANCEMENT_CHECK_TIME'.cyan);

        const enhancedArticles = ArticleEnhancementService.mergeEnhancementsWithArticles({articles: fastResults.articles, enhancements: existingEnhancements});

        const enhancedCount = enhancedArticles.filter(article => article.enhanced).length;
        const totalTime = Date.now() - startTime;

        console.log(`Enhanced multisource news fetch completed successfully: ${enhancedCount}/${enhancedArticles.length} articles have AI enhancements (${totalTime}ms)`.green.bold);

        const processingStatus = await ArticleEnhancementService.getProcessingStatus({articles: enhancedArticles});

        const status: TEnhancementStatus = processingStatus.status;
        const progress: number = processingStatus.progress;

        return {
            ...fastResults,
            articles: enhancedArticles,
            loadTime: `${totalTime}ms`,
            metadata: {
                ...fastResults.metadata,
                enhanced: enhancedCount > 0,
                enhancedCount,
                totalArticles: enhancedArticles.length,
                progressiveLoad: true,
                status,
                progress,
            },
        };
    }
}

export default NewsService;
