import "colors";
import axios from "axios";
import Fuse from "fuse.js";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import {buildHeader} from "../utils/buildHeader";
import {RSS_SOURCES, USER_AGENTS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {GUARDIAN_API_KEY, NODE_ENV, NYTIMES_API_KEY, RSS_CACHE_DURATION} from "../config/config";
import {
    Article,
    GuardianArticle,
    GuardianResponse,
    GuardianSearchParams,
    NEWSORGEverythingParams,
    NEWSORGTopHeadlinesAPIResponse,
    NEWSORGTopHeadlinesParams,
    NYTimesArticle,
    NYTimesSearchParams,
    NYTimesSearchResponse,
    NYTimesTopStoriesParams,
    NYTimesTopStoriesResponse,
    RSSFeed,
    RSSFeedParams,
    RSSSearchResult,
    ScrapeMultipleWebsitesParams,
    ScrapeWebsiteParams,
    SUPPORTED_NEWS_LANGUAGES
} from "../types/news";

const RSS_CACHE = new Map<string, { data: RSSFeed[], timestamp: number }>();
const TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
const EVERYTHING_NEWS_CACHE = new Map<string, { data: any, timestamp: number }>();
const GUARDIAN_CACHE = new Map<string, { data: any, timestamp: number }>();
const NYTIMES_CACHE = new Map<string, { data: any, timestamp: number }>();

// TODO: Remove newsApiRequestCount, guardianApiRequestCount, nytimesApiRequestCount
// API request counters for daily limits
let newsApiRequestCount = 0;
let guardianApiRequestCount = 0;
let nytimesApiRequestCount = 0;

// Reset counters daily (simplified - in production, use proper job scheduler)
setInterval(() => {
    newsApiRequestCount = 0;
    guardianApiRequestCount = 0;
    nytimesApiRequestCount = 0;
    console.log('Daily API counters reset'.cyan.italic);
}, 24 * 60 * 60 * 1000);

const convertGuardianToArticle = (guardianArticle: GuardianArticle): Article => ({
    source: {
        id: 'guardian',
        name: 'The Guardian'
    },
    author: guardianArticle.fields?.byline || null,
    title: guardianArticle.fields?.headline || guardianArticle.webTitle,
    description: guardianArticle.fields?.bodyText?.substring(0, 200) + '...' || null,
    url: guardianArticle.webUrl,
    urlToImage: guardianArticle.fields?.thumbnail || null,
    publishedAt: guardianArticle.webPublicationDate,
    content: guardianArticle.fields?.bodyText || null
});

const convertNYTimesToArticle = (nytArticle: NYTimesArticle): Article => ({
    source: {
        id: 'nytimes',
        name: 'The New York Times'
    },
    author: nytArticle.byline?.original || null,
    title: nytArticle.headline?.main || null,
    description: nytArticle.abstract || nytArticle.snippet || null,
    url: nytArticle.web_url,
    urlToImage: nytArticle.multimedia?.[0]?.url ? `https://static01.nyt.com/${nytArticle.multimedia[0].url}` : null,
    publishedAt: nytArticle.pub_date,
    content: nytArticle.lead_paragraph || null
});

const fetchNEWSORGTopHeadlines = async ({country, category, sources, q, pageSize = 10, page = 1}: NEWSORGTopHeadlinesParams) => {
    try {
        const cacheKey = `${country}-${category}-${sources}-${q}-${pageSize}-${page}`;
        const cached = TOPHEADLINES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        if (newsApiRequestCount >= 100) {
            console.log('NewsAPIOrg limit reached'.yellow.italic);
            return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
        }

        const {data: topHeadlinesResponse} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
            apis.topHeadlinesApi({country: country || 'us', category, sources, q, pageSize, page}),
            {headers: buildHeader('newsapi')},
        );
        newsApiRequestCount++;
        console.log('topHeadlines from NewsAPIOrg:'.cyan.italic, topHeadlinesResponse);

        if (NODE_ENV === 'production') {
            TOPHEADLINES_CACHE.set(cacheKey, {data: topHeadlinesResponse, timestamp: Date.now()});
        }

        return topHeadlinesResponse;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchTopHeadlines:'.red.bold, error);
        throw error;
    }
}

const fetchNEWSORGEverything = async ({sources, from, to, sortBy, language, q, pageSize = 10, page = 1}: NEWSORGEverythingParams) => {
    try {
        const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${q}-${pageSize}-${page}`;
        const cached = EVERYTHING_NEWS_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        if (newsApiRequestCount >= 100) {
            console.log('NewsAPIOrg limit reached'.yellow.italic);
            return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
        }

        const {data: everything} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
            apis.fetchEverythingApi({sources, from, to, sortBy, language, q, pageSize, page}),
            {headers: buildHeader('newsapi')},
        );
        newsApiRequestCount++;
        console.log('everything from NewsAPIOrg:'.cyan.italic, everything);

        if (NODE_ENV === 'production') {
            EVERYTHING_NEWS_CACHE.set(cacheKey, {data: everything, timestamp: Date.now()});
        }

        return everything;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchEverything:'.red.bold, error);
        throw error;
    }
}

const fetchGuardianNews = async ({q, section, fromDate, toDate, orderBy = 'newest', pageSize = 10, page = 1}: GuardianSearchParams) => {
    try {
        if (!GUARDIAN_API_KEY) {
            console.warn('Guardian API key not configured'.yellow.italic);
            return {articles: [], totalResults: 0};
        }

        if (guardianApiRequestCount >= 12000) {
            console.warn('Guardian API daily limit reached'.yellow.italic);
            return {status: 'error', message: 'Guardian API daily limit reached', articles: [], totalResults: 0};
        }

        const cacheKey = `guardian-${q}-${section}-${fromDate}-${toDate}-${orderBy}-${pageSize}-${page}`;
        const cached = GUARDIAN_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached Guardian data:'.cyan.italic);
            return cached.data;
        }

        const url = apis.guardianSearchApi({q, section, fromDate, toDate, orderBy, pageSize, page}) + `&api-key=${GUARDIAN_API_KEY}`;
        const {data: guardianResponse} = await axios.get<GuardianResponse>(url, {headers: buildHeader('guardian')});

        guardianApiRequestCount++;
        console.log(`Guardian API request ${guardianApiRequestCount}/12000:`.cyan.italic, guardianResponse.response.total, 'results');

        const articles = guardianResponse.response.results.map(convertGuardianToArticle);
        const result = {
            articles,
            totalResults: guardianResponse.response.total,
            currentPage: guardianResponse.response.currentPage,
            pages: guardianResponse.response.pages
        };

        if (NODE_ENV === 'production') {
            GUARDIAN_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        }

        return result;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchGuardianNews:'.red.bold, error.message);
        return {articles: [], totalResults: 0};
    }
}

const fetchNYTimesNews = async ({q, section, sort = 'newest', fromDate, toDate, pageSize = 10, page = 1}: NYTimesSearchParams) => {
    try {
        if (!NYTIMES_API_KEY) {
            console.warn('NYTimes API key not configured'.yellow.italic);
            return {articles: [], totalResults: 0};
        }

        if (nytimesApiRequestCount >= 1000) {
            console.warn('NYTimes API daily limit reached'.yellow.italic);
            return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
        }

        const cacheKey = `nytimes-${q}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
        const cached = NYTIMES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached NYTimes data:'.cyan.italic);
            return cached.data;
        }

        const url = apis.nytimesSearchApi({q, section, sort, fromDate, toDate, pageSize, page}) + `&api-key=${NYTIMES_API_KEY}`;
        const {data: nytResponse} = await axios.get<NYTimesSearchResponse>(url, {headers: buildHeader('nytimes')});
        console.log('Raw NYT search response:', nytResponse);
        console.log('Response status:', nytResponse.status);

        nytimesApiRequestCount++;
        console.log(`NYTimes API request ${nytimesApiRequestCount}/1000:`.cyan.italic, nytResponse?.response?.metadata?.hits, 'results');

        const articles = nytResponse.response.docs.map(convertNYTimesToArticle);
        const nytResponseMeta = nytResponse?.response?.metadata;
        if (!nytResponseMeta) {
            throw new Error('Invalid NYT API response structure');
        }
        const totalHits = nytResponseMeta?.hits || 0;
        const result = {
            articles,
            totalResults: totalHits,
            currentPage: page,
            pages: totalHits / pageSize,
        };

        if (NODE_ENV === 'production') {
            NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        }

        return result;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchNYTimesNews:'.red.bold, error.message);
        return {articles: [], totalResults: 0};
    }
}

const fetchNYTimesTopStories = async ({section = 'home'}: NYTimesTopStoriesParams) => {
    try {
        if (!NYTIMES_API_KEY) {
            console.warn('NYTimes API key not configured'.yellow.italic);
            return {articles: [], totalResults: 0};
        }

        if (nytimesApiRequestCount >= 1000) {
            console.warn('NYTimes API daily limit reached'.yellow.italic);
            return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
        }

        const cacheKey = `nytimes-top-${section}`;
        const cached = NYTIMES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached NYTimes top stories:'.cyan.italic);
            return cached.data;
        }

        const url = apis.nytimesTopStoriesApi({section}) + `?api-key=${NYTIMES_API_KEY}`;
        const {data: nytResponse} = await axios.get<NYTimesTopStoriesResponse>(url, {headers: buildHeader('nytimes')});

        nytimesApiRequestCount++;
        console.log(`NYTimes Top Stories API request ${nytimesApiRequestCount}/1000:`.cyan.italic, nytResponse.num_results, 'results');

        const articles = nytResponse.results?.map(story => ({
            source: {
                id: 'nytimes',
                name: 'The New York Times'
            },
            author: story.byline,
            title: story.title,
            description: story.abstract,
            url: story.url,
            urlToImage: story.multimedia?.[0]?.url || null,
            publishedAt: story.published_date,
            content: story.abstract
        } as Article));

        const result = {
            articles,
            totalResults: nytResponse.num_results,
            section: nytResponse.section,
            lastUpdated: nytResponse.last_updated
        };

        if (NODE_ENV === 'production') {
            NYTIMES_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        }

        return result;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchNYTimesTopStories:'.red.bold, error.message);
        return {articles: [], totalResults: 0};
    }
}

const fetchAllRSSFeeds = async ({q, sources, languages = 'english', pageSize = 10, page = 1}: RSSFeedParams) => {
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
            .flatMap(r => (r as PromiseFulfilledResult<RSSFeed[]>).value)
            .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

        if (q && q.trim()) {
            console.log(`Searching RSS feeds for: "${q}"`.cyan.italic);

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

            const searchResults = fuse.search(q.trim());

            // Convert to RSSSearchResult format and sort by date then score
            const formattedResults: RSSSearchResult[] = searchResults.map(result => ({
                item: result.item,
                score: 1 - (result.score || 0),
                matches: result.matches || [],
            }));

            // Sort by publishedAt date (newest first), then by score
            const sortedResults = formattedResults.sort((a, b) => {
                const dateA = a.item.publishedAt ? new Date(a.item.publishedAt).getTime() : 0;
                const dateB = b.item.publishedAt ? new Date(b.item.publishedAt).getTime() : 0;

                if (dateA !== dateB) {
                    return dateB - dateA; // Newest first
                }

                return b.score - a.score; // Higher score first for same date
            });

            const startIndex = (page - 1) * pageSize;
            const paginatedResults = sortedResults.slice(startIndex, startIndex + pageSize);

            console.log(`RSS search found ${searchResults.length} results for "${q}"`.green);

            const finalResults = paginatedResults.map(r => r.item);

            if (NODE_ENV === 'production') {
                RSS_CACHE.set(cacheKey, {data: finalResults, timestamp: Date.now()});
            }

            return finalResults;
        }

        // No query - return paginated results by source/language
        const startIndex = (page - 1) * pageSize;
        const paginatedResults = allItems.slice(startIndex, startIndex + pageSize);

        if (NODE_ENV === 'production') {
            RSS_CACHE.set(cacheKey, {data: paginatedResults, timestamp: Date.now()});
        }

        return paginatedResults;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchRSSFeed:'.red.bold, error);
        throw error;
    }
}

// TODO: REMOVE
const smartFetchNews = async ({q, category, sources, pageSize = 10, page = 1}: {
    q?: string;
    category?: string;
    sources?: string;
    pageSize?: number;
    page?: number;
}) => {
    console.log('Starting smart news fetch with fallback chain:'.bgBlue.white.bold, {q, category, sources});

    const results: Article[] = [];
    let totalResults = 0;
    const usedSources: string[] = [];

    // Step 1: Try NewsAPI (100 requests/day) - Check limit before calling nested functions
    if (newsApiRequestCount < 100) {
        try {
            console.log('Trying NewsAPI...'.cyan.italic);
            let newsApiResult;

            if (q) {
                // For queries, use everything endpoint but respect the limit
                if (newsApiRequestCount < 100) {
                    const {data: everything} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
                        apis.fetchEverythingApi({q, sources, pageSize: Math.ceil(pageSize * 0.4), page}),
                        {headers: buildHeader('newsapi')}
                    );
                    newsApiRequestCount++;
                    newsApiResult = everything;
                }
            } else {
                // For top headlines, use headlines endpoint but respect the limit
                if (newsApiRequestCount < 100) {
                    const {data: topHeadlines} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
                        apis.topHeadlinesApi({country: 'us', category, sources, pageSize: Math.ceil(pageSize * 0.4), page}),
                        {headers: buildHeader('newsapi')}
                    );
                    newsApiRequestCount++;
                    newsApiResult = topHeadlines;
                }
            }

            if (newsApiResult && newsApiResult.articles) {
                results.push(...newsApiResult.articles);
                totalResults += newsApiResult.totalResults || 0;
                usedSources.push('NewsAPI');
                console.log(`NewsAPI contributed ${newsApiResult.articles.length} articles`.green);
            }
        } catch (error) {
            console.log('NewsAPI failed, continuing...'.yellow.italic);
        }
    } else {
        console.log('NewsAPI limit reached, skipping...'.yellow.italic);
    }

    // Step 2: Try Guardian API (12K requests/day)
    if (results.length < pageSize && guardianApiRequestCount < 12000) {
        try {
            console.log('Trying Guardian API...'.cyan.italic);
            const guardianResult = await fetchGuardianNews({
                q,
                section: category,
                pageSize: Math.ceil(pageSize * 0.4),
                page
            });

            if (guardianResult && guardianResult.articles) {
                // Filter duplicates by URL
                const newArticles = guardianResult.articles.filter((article: any) =>
                    !results.some(existing => existing.url === article.url)
                );
                results.push(...newArticles);
                totalResults += guardianResult.totalResults || 0;
                usedSources.push('Guardian');
                console.log(`Guardian contributed ${newArticles.length} articles`.green);
            }
        } catch (error) {
            console.log('Guardian API failed, continuing...'.yellow.italic);
        }
    } else if (guardianApiRequestCount >= 12000) {
        console.log('Guardian API limit reached, skipping...'.yellow.italic);
    }

    // Step 3: Try NYTimes API (1K requests/day)
    if (results.length < pageSize && nytimesApiRequestCount < 1000) {
        try {
            console.log('Trying NYTimes API...'.cyan.italic);
            const nytResult = q
                ? await fetchNYTimesNews({q, section: category, pageSize: Math.ceil(pageSize * 0.3), page})
                : await fetchNYTimesTopStories({section: category});

            if (nytResult && nytResult.articles) {
                // Filter duplicates by URL
                const newArticles = nytResult.articles.filter((article: any) =>
                    !results.some(existing => existing.url === article.url)
                );
                results.push(...newArticles.slice(0, Math.ceil(pageSize * 0.3)));
                totalResults += nytResult.totalResults || 0;
                usedSources.push('NYTimes');
                console.log(`NYTimes contributed ${newArticles.length} articles`.green);
            }
        } catch (error) {
            console.log('NYTimes API failed, continuing...'.yellow.italic);
        }
    } else if (nytimesApiRequestCount >= 1000) {
        console.log('NYTimes API limit reached, skipping...'.yellow.italic);
    }

    // Step 4: Fallback to RSS if still need more articles
    if (results.length < pageSize) {
        try {
            console.log('Falling back to RSS feeds...'.cyan.italic);
            const rssResults = await fetchAllRSSFeeds({
                sources,
                pageSize: pageSize - results.length,
                page
            });

            if (rssResults && rssResults.length > 0) {
                // Convert RSS to Article format
                const rssArticles = rssResults.map(rss => ({
                    source: {
                        id: null,
                        name: rss.source?.name || 'RSS Feed'
                    },
                    author: rss.source?.creator || null,
                    title: rss.title || null,
                    description: rss.contentSnippet || null,
                    url: rss.url || null,
                    urlToImage: null,
                    publishedAt: rss.publishedAt || null,
                    content: rss.content || null
                } as Article));

                results.push(...rssArticles);
                usedSources.push('RSS');
                console.log(`RSS contributed ${rssArticles.length} articles`.green);
            }
        } catch (error) {
            console.log('RSS fallback failed'.yellow.italic);
        }
    }

    console.log(`Smart fetch completed. Total: ${results.length} articles from [${usedSources.join(', ')}]`.bgGreen.white.bold);

    return {
        status: 'ok',
        totalResults,
        articles: results.slice(0, pageSize),
        metadata: {
            usedSources,
            apiRequestCounts: {
                newsApi: newsApiRequestCount,
                guardian: guardianApiRequestCount,
                nytimes: nytimesApiRequestCount,
            },
        },
    };
}

const scrapeArticle = async ({url}: ScrapeWebsiteParams) => {
    console.info('scrapeArticle called:'.bgMagenta.white.italic, url);
    try {
        if (!url) {
            return {error: generateMissingCode('url')};
        }

        let response: any;
        for (const userAgent of USER_AGENTS) {
            try {
                response = await axios.get(url, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Referer': 'https://www.google.com/',
                    },
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
        }); // Silent
        virtualConsole.on('warn', () => {
        }); // Silent

        const dom = new JSDOM(response.data, {
            url,
            virtualConsole,
            pretendToBeVisual: false,
            resources: 'usable',
        });

        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article) {
            throw new Error('Failed to parse article content');
        }

        return {
            url,
            title: article.title || '',
            content: article.textContent || '',
            excerpt: article.excerpt || '',
            byline: article.byline || '',
            length: article.length || 0,
            readingTimeMinutes: Math.ceil((article.length || 0) / 200),
            timestamp: new Date().toISOString(),
            method: 'readability',
            status: 200,
        };
    } catch (error: any) {
        console.error('ERROR: inside catch of scrapeArticle:'.red.bold, error);
        throw error;
    }
}

const scrapeMultipleArticles = async ({urls}: ScrapeMultipleWebsitesParams) => {
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
            const article = await scrapeArticle({url});
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

export {fetchNEWSORGTopHeadlines, fetchNEWSORGEverything, fetchGuardianNews, fetchNYTimesNews, fetchNYTimesTopStories, fetchAllRSSFeeds, smartFetchNews, scrapeMultipleArticles};
