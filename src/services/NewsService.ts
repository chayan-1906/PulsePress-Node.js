import "colors";
import axios from "axios";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import {RSS_SOURCES} from "../utils/constants";
import {buildHeader} from "../utils/buildHeader";
import {NODE_ENV, RSS_CACHE_DURATION} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {FetchEverythingParams, RSSFeed, RSSFeedParams, ScrapeMultipleWebsitesParams, ScrapeWebsiteParams, SUPPORTED_NEWS_LANGUAGES, TopHeadlinesAPIResponse, TopHeadlinesParams} from "../types/news";

const RSS_CACHE = new Map<string, { data: RSSFeed[], timestamp: number }>();
const TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
const EVERYTHING_NEWS_CACHE = new Map<string, { data: any, timestamp: number }>();

// https://newsapi.org/docs/endpoints/top-headlines
const fetchTopHeadlines = async ({country, category, sources, q, pageSize = 10, page = 1}: TopHeadlinesParams) => {
    try {
        const cacheKey = `${country}-${category}-${sources}-${q}-${pageSize}-${page}`;
        const cached = TOPHEADLINES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        const {data: topHeadlinesResponse} = await axios.get<TopHeadlinesAPIResponse>(apis.topHeadlinesApi({country: country || 'us', category, sources, q, pageSize, page}), {headers: buildHeader()});
        console.log('topHeadlines:'.cyan.italic, topHeadlinesResponse);

        TOPHEADLINES_CACHE.set(cacheKey, {data: topHeadlinesResponse, timestamp: Date.now()});

        // fallback → fetch RSS feeds
        if (topHeadlinesResponse.articles.length === 0) {
            return await fetchRSSFeed({});
        }
        return topHeadlinesResponse;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchTopHeadlines:'.red.bold, error);

        // fallback → fetch RSS feeds
        return await fetchRSSFeed({});
    }
}

const fetchRSSFeed = async ({sources, languages = 'english', pageSize = 10, page = 1}: RSSFeedParams) => {
    try {
        const cacheKey = `${sources}-${languages}-${pageSize}-${page}`;
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

        const startIndex = (page - 1) * pageSize;

        RSS_CACHE.set(cacheKey, {data: allItems.slice(startIndex, startIndex + pageSize), timestamp: Date.now()});
        return allItems.slice(startIndex, startIndex + pageSize);
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchRSSFeed:'.red.bold, error);
        throw error;
    }
}

const fetchEverything = async ({sources, from, to, sortBy, language, q, pageSize = 10, page = 1}: FetchEverythingParams) => {
    try {
        const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${q}-${pageSize}-${page}`;
        const cached = EVERYTHING_NEWS_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        const {data: everything} = await axios.get<TopHeadlinesAPIResponse>(apis.fetchEverythingApi({sources, from, to, sortBy, language, q, pageSize, page}), {headers: buildHeader()});
        console.log('everything:'.cyan.italic, everything);

        EVERYTHING_NEWS_CACHE.set(cacheKey, {data: everything, timestamp: Date.now()});

        return everything;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchEverything:'.red.bold, error);
        throw error;
    }
}

const scrapeArticle = async ({url}: ScrapeWebsiteParams) => {
    console.info('scrapeArticle called:'.bgMagenta.white.italic, url);
    try {
        if (!url) {
            return {error: generateMissingCode('url')};
        }

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ];

        let response: any;
        for (const userAgent of userAgents) {
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
                if (userAgent === userAgents[userAgents.length - 1]) {
                    throw error; // Last attempt failed
                }
                continue; // Try next user agent
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

export {fetchTopHeadlines, fetchRSSFeed, fetchEverything, scrapeMultipleArticles};
