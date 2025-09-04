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
import {API_CONFIG, RSS_SOURCES, USER_AGENTS} from "../utils/constants";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {assessContentQuality, isDuplicateArticle} from "../utils/serviceHelpers/articleQuality";
import {cleanScrapedText, generateQueryVariations, simplifySearchQuery} from "../utils/serviceHelpers/textProcessing";
import {determineTopicFromQuery, getOptimizedSourcesForTopic, mapToNewYorkTimesSection} from "../utils/serviceHelpers/topicMapping";
import {GUARDIAN_API_KEY, GUARDIAN_QUOTA_REQUESTS, NEWSAPI_QUOTA_REQUESTS, NEWSAPIORG_QUOTA_MS, NODE_ENV, NYTIMES_API_KEY, NYTIMES_QUOTA_REQUESTS} from "../config/config";
import {convertGuardianToArticle, convertNewYorkTimesToArticle, convertNewYorkTimesTopStoryToArticle, convertRSSFeedToArticle} from "../utils/serviceHelpers/articleConverters";
import {
    IArticle,
    IGuardianResponse,
    IGuardianSearchParams,
    IMultisourceFetchNewsParams,
    INewsApiOrgEverythingParams,
    INewsApiOrgTopHeadlinesAPIResponse,
    INewsApiOrgTopHeadlinesParams,
    INewYorkTimesSearchParams,
    INewYorkTimesSearchResponse,
    INewYorkTimesTopStoriesParams,
    INewYorkTimesTopStoriesResponse,
    IRssFeed,
    IRssFeedParams,
    IScrapeMultipleWebsitesParams,
    IScrapeWebsiteParams,
    SUPPORTED_NEWS_LANGUAGES,
    TEnhancementStatus,
    VALID_NYTIMES_SECTIONS
} from "../types/news";

const RSS_CACHE = new Map<string, { data: IRssFeed[], timestamp: number }>();
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
     * Fetch top headlines from NewsAPI.org with caching
     */
    static async fetchNewsApiOrgTopHeadlines({country, category, sources, q, pageSize = 10, page = 1}: INewsApiOrgTopHeadlinesParams) {
        console.log('Service: NewsService.fetchNewsApiOrgTopHeadlines called'.cyan.italic, {country, category, sources, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsApiOrgTopHeadlines processing query: "${q}"`.cyan);
                processedQuery = simplifySearchQuery(q.trim());
                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${country}-${category}-${sources}-${processedQuery}-${pageSize}-${page}`;
            const cached = TOPHEADLINES_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
                console.warn('Rate Limit: NewsApi daily limit reached'.yellow);
                return {status: 'error', message: 'NewsApi daily limit reached', articles: [], totalResults: 0};
            }

            const {data: topHeadlinesResponse} = await axios.get<INewsApiOrgTopHeadlinesAPIResponse>(
                apis.topHeadlinesApi({country: country || 'us', category, sources, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            newsApiRequestCount++;
            console.log('External API: NewsApi TopHeadlines response'.magenta, topHeadlinesResponse);

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
            console.error('Service Error: NewsService.fetchNewsApiOrgTopHeadlines failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Fetch everything articles from NewsAPI.org with caching
     */
    static async fetchNewsApiOrgEverything({sources, from, to, sortBy, language, q, pageSize = 10, page = 1}: INewsApiOrgEverythingParams) {
        console.log('Service: NewsService.fetchNewsApiOrgEverything called'.cyan.italic, {sources, from, to, sortBy, language, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsApiOrgEverything processing query: "${q}"`.cyan);

                processedQuery = q.trim();

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${processedQuery}-${pageSize}-${page}`;
            const cached = EVERYTHING_NEWS_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
                console.log('NewsApi limit reached'.yellow);
                return {status: 'error', message: 'NewsApi daily limit reached', articles: [], totalResults: 0};
            }

            const {data: everything} = await axios.get<INewsApiOrgTopHeadlinesAPIResponse>(
                apis.fetchEverythingApi({sources, from, to, sortBy, language, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            newsApiRequestCount++;
            console.log('External API: NewsApi Everything response'.magenta, everything);

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
            console.error('Service Error: NewsService.fetchNewsApiOrgEverything failed:'.red.bold, error);
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

                processedQuery = simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `guardian-${processedQuery}-${section}-${fromDate}-${toDate}-${orderBy}-${pageSize}-${page}`;
            const cached = GUARDIAN_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached Guardian data'.cyan);
                return cached.data;
            }

            const url = apis.guardianSearchApi({q: processedQuery, section, fromDate, toDate, orderBy, pageSize, page}) + `&api-key=${GUARDIAN_API_KEY}`;
            const {data: guardianResponse} = await axios.get<IGuardianResponse>(url, {headers: buildHeader('guardian')});

            guardianApiRequestCount++;
            console.log(`External API: Guardian request ${guardianApiRequestCount}/${GUARDIAN_QUOTA_REQUESTS}:`.magenta, guardianResponse.response.total, 'results');

            const articles = guardianResponse.response.results.map(convertGuardianToArticle);
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
    static async fetchNewYorkTimesNews({q, section, sort = 'newest', fromDate, toDate, pageSize = 10, page = 1}: INewYorkTimesSearchParams) {
        console.log('Service: NewsService.fetchNewYorkTimesNews called'.cyan.italic, {q, section, sort, fromDate, toDate, pageSize, page});

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

                processedQuery = simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `nytimes-${processedQuery}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
            const cached = NYTIMES_CACHE.get(cacheKey);
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached NYTimes data'.cyan);
                return cached.data;
            }

            const url = apis.nytimesSearchApi({q: processedQuery, section, sort, fromDate, toDate, pageSize, page}) + `&api-key=${NYTIMES_API_KEY}`;
            const {data: nytResponse} = await axios.get<INewYorkTimesSearchResponse>(url, {headers: buildHeader('nytimes')});
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

            const articles: IArticle[] = nytResponse.response.docs.map(convertNewYorkTimesToArticle);
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
    static async fetchNewYorkTimesTopStories({section = 'home'}: INewYorkTimesTopStoriesParams) {
        console.log('Service: NewsService.fetchNewYorkTimesTopStories called'.cyan.italic, {section});

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
            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached NYTimes top stories'.cyan);
                return cached.data;
            }

            const url = apis.nytimesTopStoriesApi({section}) + `?api-key=${NYTIMES_API_KEY}`;
            const {data: nytResponse} = await axios.get<INewYorkTimesTopStoriesResponse>(url, {headers: buildHeader('nytimes')});

            nytimesApiRequestCount++;
            console.log(`External API: NYTimes Top Stories request ${nytimesApiRequestCount}/${NYTIMES_QUOTA_REQUESTS}:`.magenta, nytResponse.num_results, 'results');

            const articles: IArticle[] = nytResponse.results?.map(convertNewYorkTimesTopStoryToArticle);

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
    static async fetchAllRssFeeds({q, sources, languages = 'english', pageSize = 10, page = 1}: IRssFeedParams) {
        console.log('Service: NewsService.fetchAllRssFeeds called'.cyan.italic, {q, sources, languages, pageSize, page});

        try {
            const cacheKey = `${q}-${sources}-${languages}-${pageSize}-${page}`;
            const cached = RSS_CACHE.get(cacheKey);

            if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
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
                .flatMap(r => (r as PromiseFulfilledResult<IRssFeed[]>).value)
                .sort((a: IRssFeed, b: IRssFeed) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

            if (q && q.trim()) {
                console.log(`Service: fetchAllRSSFeeds searching for: "${q}"`.cyan);

                const simplifiedQuery = simplifySearchQuery(q.trim());
                const expandedTerms = simplifiedQuery.split(' ').filter(term => term.length > 2);

                const fuse = new Fuse(allItems, {
                    keys: [
                        {name: 'title', weight: 0.7},
                        {name: 'contentSnippet', weight: 0.3},
                        {name: 'categories', weight: 0.2},
                    ],
                    threshold: API_CONFIG.SEARCH.FUSE_THRESHOLD,
                    includeScore: true,
                    includeMatches: true,
                    minMatchCharLength: API_CONFIG.SEARCH.MIN_QUERY_LENGTH,
                    ignoreLocation: true,
                });

                const allResults = new Map<string, { item: IRssFeed, score: number }>();
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
            console.error('Service Error: NewsService.fetchAllRssFeeds failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Smart fetch with query variations and quality filtering
     */
    private static async smartFetchWithVariations(apiFunction: Function, query: string, params: any, minQualityResults: number = 3): Promise<any> {
        console.log('Service: NewsService.smartFetchWithVariations called'.cyan.italic, {query, params, minQualityResults});

        const queryVariations = generateQueryVariations(query);
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
                            article.qualityScore = assessContentQuality(article, query); // Use original query for relevance
                            return article;
                        })
                        .filter((article: IArticle) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > API_CONFIG.SEARCH.FUSE_THRESHOLD);

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

        const topic = determineTopicFromQuery(q, category);
        const simplifiedQuery = q ? simplifySearchQuery(q) : q;
        const optimizedSources = getOptimizedSourcesForTopic(topic, sources);
        const nytSection = mapToNewYorkTimesSection(topic);

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
                    this.fetchNewsApiOrgEverything,
                    simplifiedQuery,
                    {language: 'en', sortBy: 'relevancy', pageSize: newsApiTargetCount * API_CONFIG.NEWS_API.RESULT_MULTIPLIER, page},
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

                    const fallbackResult = await this.fetchNewsApiOrgTopHeadlines({
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
                const headlinesResult = await this.fetchNewsApiOrgTopHeadlines({
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
                        {section: topic !== 'general' ? topic : undefined, orderBy: 'relevance', pageSize: guardianTargetCount * API_CONFIG.NEWS_API.RESULT_MULTIPLIER, page},
                        Math.max(1, Math.ceil(guardianTargetCount / 3)) // Need at least 1 good result
                    );

                    if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                        const qualityArticles = guardianResult.articles
                            .filter((article: IArticle) => !isDuplicateArticle(article, results))
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
                            .filter((article: IArticle) => !isDuplicateArticle(article, results))
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
                            this.fetchNewYorkTimesNews,
                            simplifiedQuery,
                            {section: nytSection, sort: 'relevance', pageSize: nytimesTargetCount * API_CONFIG.NEWS_API.RESULT_MULTIPLIER, page},
                            Math.max(1, Math.ceil(nytimesTargetCount / 3)) // Need at least 1 good result
                        );

                        if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                            const qualityArticles = nytResult.articles
                                .filter((article: IArticle) => !isDuplicateArticle(article, results))
                                .sort((a: IArticle, b: IArticle) => b.qualityScore!.score - a.qualityScore!.score)
                                .slice(0, nytimesTargetCount);

                            results.push(...qualityArticles);
                            usedSources.push(`NYTimes (${nytResult.usedQuery})`);
                            console.log(`NYTimes contributed ${qualityArticles.length} quality articles using query: "${nytResult.usedQuery}"`.cyan);
                        }
                    } else {
                        const nytResult = await this.fetchNewYorkTimesTopStories({section: nytSection});

                        if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                            const articles = nytResult.articles
                                .filter((article: IArticle) => !isDuplicateArticle(article, results))
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

                const rssResults = await this.fetchAllRssFeeds({q: simplifiedQuery, sources: optimizedSources, pageSize: remainingSlots3 * 2, page});

                if (rssResults && rssResults.length > 0) {
                    const rssArticles = rssResults.map(convertRSSFeedToArticle);

                    const qualityArticles = rssArticles
                        .map(article => {
                            article.qualityScore = assessContentQuality(article, q);
                            return article;
                        })
                        .filter((article: IArticle) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.2 && !isDuplicateArticle(article, results))
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

            const cleanedContent = cleanScrapedText(article.textContent || '');

            return {
                url,
                title: cleanScrapedText(article.title || ''),
                content: cleanedContent,
                excerpt: cleanScrapedText(article.excerpt || ''),
                byline: cleanScrapedText(article.byline || ''),
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
        const topic = determineTopicFromQuery(q, category);
        const simplifiedQuery = q ? simplifySearchQuery(q) : q;
        const optimizedSources = getOptimizedSourcesForTopic(topic, sources);

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
                    this.fetchNewsApiOrgEverything({
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
                    this.fetchNewsApiOrgTopHeadlines({
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
        const nytSection = mapToNewYorkTimesSection(topic);
        if (nytimesApiRequestCount < Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
            if (simplifiedQuery) {
                apiPromises.push(
                    this.fetchNewYorkTimesNews({
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
                    this.fetchNewYorkTimesTopStories({section: nytSection})
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
        apiPromises.push(this.fetchAllRssFeeds({
                q: simplifiedQuery,
                sources: optimizedSources,
                pageSize: rssCount,
                page,
            }).then(rssResults => {
                const articles = rssResults.map(convertRSSFeedToArticle);
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
            ArticleEnhancementService.enhanceArticlesInBackground({email: email || '', articles: sortedResults}).then(() => {
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
