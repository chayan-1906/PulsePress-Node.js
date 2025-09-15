import "colors";
import axios from "axios";
import Fuse from "fuse.js";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import QuotaService from "./QuotaService";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import {buildHeader} from "../utils/buildHeader";
import {generateArticleId} from "../utils/generateArticleId";
import ArticleEnhancementService from "./ArticleEnhancementService";
import {API_CONFIG, RSS_SOURCES, USER_AGENTS} from "../utils/constants";
import {GUARDIAN_API_KEY, NYTIMES_API_KEY} from "../config/config";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {cleanScrapedText, simplifySearchQuery} from "../utils/serviceHelpers/textProcessing";
import {determineTopicFromQuery, getOptimizedSourcesForTopic, mapToNewYorkTimesSection} from "../utils/serviceHelpers/topicMapping";
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
    VALID_NYTIMES_SECTIONS,
} from "../types/news";

class NewsService {
    private static readonly RSS_CACHE = new Map<string, { data: IRssFeed[], timestamp: number }>();
    private static readonly TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
    private static readonly EVERYTHING_NEWS_CACHE = new Map<string, { data: any, timestamp: number }>();
    private static readonly GUARDIAN_CACHE = new Map<string, { data: any, timestamp: number }>();
    private static readonly NYTIMES_CACHE = new Map<string, { data: any, timestamp: number }>();

    /**
     * Fetch top headlines from NewsAPI.org with caching
     */
    static async fetchNewsApiOrgTopHeadlines({country, category, sources, q, pageSize = 5, page = 1}: INewsApiOrgTopHeadlinesParams) {
        console.log('Service: NewsService.fetchNewsApiOrgTopHeadlines called'.cyan.italic, {country, category, sources, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsApiOrgTopHeadlines processing query: "${q}"`.cyan);
                processedQuery = simplifySearchQuery(q.trim());
                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${country}-${category}-${sources}-${processedQuery}-${pageSize}-${page}`;
            const cached = this.TOPHEADLINES_CACHE.get(cacheKey);
            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            const quotaResponse = await QuotaService.reserveQuotaBeforeApiCall({service: 'newsapi', count: 1});
            if (!quotaResponse.allowed) {
                console.warn('Rate Limit: NewsApi daily limit reached'.yellow);
                return {status: 'error', message: 'NewsApi daily limit reached', articles: [], totalResults: 0};
            }

            const {data: topHeadlinesResponse} = await axios.get<INewsApiOrgTopHeadlinesAPIResponse>(
                apis.topHeadlinesApi({country: country || 'us', category, sources, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            console.log('External API: NewsApi TopHeadlines response'.magenta, topHeadlinesResponse);

            if (topHeadlinesResponse.articles) {
                topHeadlinesResponse.articles = topHeadlinesResponse.articles.map((article: IArticle) => ({
                    ...article,
                    articleId: generateArticleId({article}),
                }));
            }

            // if (NODE_ENV === 'production') {
            this.TOPHEADLINES_CACHE.set(cacheKey, {data: topHeadlinesResponse, timestamp: Date.now()});
            // }

            return topHeadlinesResponse;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNewsApiOrgTopHeadlines failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Fetch everything articles from NewsAPI.org with caching
     */
    static async fetchNewsApiOrgEverything({sources, from, to, sortBy, language, q, pageSize = 5, page = 1}: INewsApiOrgEverythingParams) {
        console.log('Service: NewsService.fetchNewsApiOrgEverything called'.cyan.italic, {sources, from, to, sortBy, language, q, pageSize, page});

        try {
            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewsApiOrgEverything processing query: "${q}"`.cyan);

                processedQuery = q.trim();

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${processedQuery}-${pageSize}-${page}`;
            const cached = this.EVERYTHING_NEWS_CACHE.get(cacheKey);
            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached data'.cyan, cached.data);
                return cached.data;
            }

            const quotaResponse = await QuotaService.reserveQuotaBeforeApiCall({service: 'newsapi', count: 1});
            if (!quotaResponse.allowed) {
                console.log('NewsApi limit reached'.yellow);
                return {status: 'error', message: 'NewsApi daily limit reached', articles: [], totalResults: 0};
            }

            const {data: everything} = await axios.get<INewsApiOrgTopHeadlinesAPIResponse>(
                apis.fetchEverythingApi({sources, from, to, sortBy, language, q: processedQuery, pageSize, page}),
                {headers: buildHeader('newsapi')},
            );
            console.log('External API: NewsApi Everything response'.magenta, everything);

            if (everything.articles) {
                everything.articles = everything.articles.map((article: IArticle) => ({
                    ...article,
                    articleId: generateArticleId({article}),
                }));
            }

            // if (NODE_ENV === 'production') {
            this.EVERYTHING_NEWS_CACHE.set(cacheKey, {data: everything, timestamp: Date.now()});
            // }

            return everything;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNewsApiOrgEverything failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Fetch news from Guardian API with caching
     */
    static async fetchGuardianNews({q, section, fromDate, toDate, orderBy = 'newest', pageSize = 5, page = 1}: IGuardianSearchParams) {
        console.log('Service: NewsService.fetchGuardianNews called'.cyan.italic, {q, section, fromDate, toDate, orderBy, pageSize, page});

        try {
            if (!GUARDIAN_API_KEY) {
                console.warn('Config Warning: Guardian API key not configured'.yellow.italic);
                return {articles: [], totalResults: 0};
            }

            const quotaResponse = await QuotaService.reserveQuotaBeforeApiCall({service: 'guardian', count: 1});
            if (!quotaResponse.allowed) {
                console.warn('Rate Limit: Guardian API daily limit reached'.yellow);
                return {status: 'error', message: 'Guardian API daily limit reached', articles: [], totalResults: 0};
            }

            let processedQuery = q?.replace(/–/g, '-');

            if (q && q.trim()) {
                console.log(`Service: fetchGuardianNews processing query: "${q}"`.cyan);

                processedQuery = simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `guardian-${processedQuery}-${section}-${fromDate}-${toDate}-${orderBy}-${pageSize}-${page}`;
            const cached = this.GUARDIAN_CACHE.get(cacheKey);
            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached Guardian data'.cyan);
                return cached.data;
            }

            const url = apis.guardianSearchApi({q: processedQuery, section, fromDate, toDate, orderBy, pageSize, page}) + `&api-key=${GUARDIAN_API_KEY}`;
            const {data: guardianResponse} = await axios.get<IGuardianResponse>(url, {headers: buildHeader('guardian')});

            const currentGuardianCount = await QuotaService.getCurrentCount({service: 'guardian'});
            console.log(`External API: Guardian request ${currentGuardianCount}:`.magenta, guardianResponse.response.total, 'results');

            const articles = guardianResponse.response.results.map(convertGuardianToArticle);
            const result = {
                articles,
                totalResults: guardianResponse.response.total,
                currentPage: guardianResponse.response.currentPage,
                pages: guardianResponse.response.pages,
            };

            // if (NODE_ENV === 'production') {
            this.GUARDIAN_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            // }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchGuardianNews failed:'.red.bold, error);
            return {articles: [], totalResults: 0};
        }
    }

    /**
     * Fetch news from NY Times search API with caching
     */
    static async fetchNewYorkTimesNews({q, section, sort = 'newest', fromDate, toDate, pageSize = 5, page = 1}: INewYorkTimesSearchParams) {
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

            const quotaResponse = await QuotaService.reserveQuotaBeforeApiCall({service: 'nytimes', count: 1});
            if (!quotaResponse.allowed) {
                console.warn('Rate Limit: NYTimes API daily limit reached'.yellow);
                return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
            }

            let processedQuery = q;

            if (q && q.trim()) {
                console.log(`Service: fetchNewYorkTimesNews processing query: "${q}"`.cyan);

                processedQuery = simplifySearchQuery(q.trim());

                console.log(`Query processed: "${q}" → "${processedQuery}"`.cyan);
            }

            const cacheKey = `nytimes-${processedQuery}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
            const cached = this.NYTIMES_CACHE.get(cacheKey);
            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
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

            const currentNytimesCount = await QuotaService.getCurrentCount({service: 'nytimes'});
            console.log(`External API: NYTimes request ${currentNytimesCount}:`.magenta, nytResponse?.response?.metadata?.hits || 0, 'results');

            if (!nytResponse.response || !nytResponse.response.docs) {
                console.warn('Service Error: NYT API returned invalid response structure'.red.bold, nytResponse.response);
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

            // if (NODE_ENV === 'production') {
            this.NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            // }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNewYorkTimesNews failed:'.red.bold, error.message);
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

            const quotaResponse = await QuotaService.reserveQuotaBeforeApiCall({service: 'nytimes', count: 1});
            if (!quotaResponse.allowed) {
                console.warn('Rate Limit: NYTimes API daily limit reached'.yellow);
                return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
            }

            const cacheKey = `nytimes-top-${section}`;
            const cached = this.NYTIMES_CACHE.get(cacheKey);
            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
                console.log('Cache: returning cached NYTimes top stories'.cyan);
                return cached.data;
            }

            const url = apis.nytimesTopStoriesApi({section}) + `?api-key=${NYTIMES_API_KEY}`;
            const {data: nytResponse} = await axios.get<INewYorkTimesTopStoriesResponse>(url, {headers: buildHeader('nytimes')});

            const currentNytimesCount = await QuotaService.getCurrentCount({service: 'nytimes'});
            console.log(`External API: NYTimes Top Stories request ${currentNytimesCount}:`.magenta, nytResponse.num_results, 'results');

            const articles: IArticle[] = nytResponse.results?.map(convertNewYorkTimesTopStoryToArticle);

            const result = {
                articles,
                totalResults: nytResponse.num_results,
                section: nytResponse.section,
                lastUpdated: nytResponse.last_updated,
            };

            // if (NODE_ENV === 'production') {
            this.NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
            // }

            return result;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchNYTimesTopStories failed:'.red.bold, error.message);
            return {articles: [], totalResults: 0};
        }
    }

    /**
     * Fetch and search RSS feeds from multiple sources with fuzzy matching
     */
    static async fetchAllRssFeeds({q, sources, languages = 'english', pageSize = 5, page = 1}: IRssFeedParams) {
        console.log('Service: NewsService.fetchAllRssFeeds called'.cyan.italic, {q, sources, languages, pageSize, page});

        try {
            const cacheKey = `${q}-${sources}-${languages}-${pageSize}-${page}`;
            const cached = this.RSS_CACHE.get(cacheKey);

            if (/*NODE_ENV === 'production' && */cached && Date.now() - cached.timestamp < API_CONFIG.SEARCH.CACHE_TTL_MS) {
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

                // if (NODE_ENV === 'production') {
                this.RSS_CACHE.set(cacheKey, {data: finalResults, timestamp: Date.now()});
                // }

                return finalResults;
            }

            const startIndex = (page - 1) * pageSize;
            const paginatedResults = allItems.slice(startIndex, startIndex + pageSize);

            // if (NODE_ENV === 'production') {
            this.RSS_CACHE.set(cacheKey, {data: paginatedResults, timestamp: Date.now()});
            // }

            return paginatedResults;
        } catch (error: any) {
            console.error('Service Error: NewsService.fetchAllRssFeeds failed:'.red.bold, error);
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
     * Enhanced multi-source news fetch with AI enhancements and progressive loading
     */
    static async fetchMultiSourceNewsEnhanced({email, q, category, sources, pageSize = 5, page = 1}: IMultisourceFetchNewsParams) {
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
     * Fast multi-source news fetch with parallel API calls and simple deduplication
     */
    private static async fetchMultiSourceNewsFast({email, q, category, sources, pageSize = 5, page = 1}: IMultisourceFetchNewsParams) {
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
        if (await QuotaService.hasQuotaAvailable({service: 'newsapi'})) {
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
        if (await QuotaService.hasQuotaAvailable({service: 'guardian'})) {
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
        if (await QuotaService.hasQuotaAvailable({service: 'nytimes'})) {
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
            ArticleEnhancementService.enhanceArticles({email: email || '', articles: sortedResults}).then(() => {
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
                    newsApi: await QuotaService.getCurrentCount({service: 'newsapi'}),
                    guardian: await QuotaService.getCurrentCount({service: 'guardian'}),
                    nytimes: await QuotaService.getCurrentCount({service: 'nytimes'}),
                },
            },
        };
    }
}

export default NewsService;
