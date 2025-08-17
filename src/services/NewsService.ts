import "colors";
import axios from "axios";
import Fuse from "fuse.js";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import {getUserByEmail} from "./AuthService";
import {buildHeader} from "../utils/buildHeader";
import SentimentAnalysisService from "./SentimentAnalysisService";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {RSS_SOURCES, TOPIC_SPECIFIC_SOURCES, TRUSTED_NEWS_SOURCES, USER_AGENTS} from "../utils/constants";
import {GUARDIAN_API_KEY, GUARDIAN_QUOTA_REQUESTS, NEWSAPI_QUOTA_REQUESTS, NEWSAPIORG_QUOTA_MS, NODE_ENV, NYTIMES_API_KEY, NYTIMES_QUOTA_REQUESTS, RSS_CACHE_DURATION} from "../config/config";
import {
    Article,
    GuardianArticle,
    GuardianResponse,
    GuardianSearchParams,
    MultisourceFetchNewsParams,
    NEWSORGEverythingParams,
    NEWSORGTopHeadlinesAPIResponse,
    NEWSORGTopHeadlinesParams,
    NYTimesArticle,
    NYTimesSearchParams,
    NYTimesSearchResponse,
    NYTimesTopStoriesParams,
    NYTimesTopStoriesResponse,
    QualityScore,
    RSSFeed,
    RSSFeedParams,
    ScrapeMultipleWebsitesParams,
    ScrapeWebsiteParams,
    SUPPORTED_NEWS_LANGUAGES,
    VALID_NYTIMES_SECTIONS
} from "../types/news";

const RSS_CACHE = new Map<string, { data: RSSFeed[], timestamp: number }>();
const TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
const EVERYTHING_NEWS_CACHE = new Map<string, { data: any, timestamp: number }>();
const GUARDIAN_CACHE = new Map<string, { data: any, timestamp: number }>();
const NYTIMES_CACHE = new Map<string, { data: any, timestamp: number }>();

let newsApiRequestCount = 0;
let guardianApiRequestCount = 0;
let nytimesApiRequestCount = 0;

// Reset counters daily (simplified - in production, use proper job scheduler)
setInterval(() => {
    newsApiRequestCount = 0;
    guardianApiRequestCount = 0;
    nytimesApiRequestCount = 0;
    console.log('Daily API counters reset'.cyan.italic);
}, Number.parseInt(NEWSAPIORG_QUOTA_MS!));

const convertGuardianToArticle = (guardianArticle: GuardianArticle): Article => ({
    source: {
        id: 'guardian',
        name: 'The Guardian',
    },
    author: guardianArticle.fields?.byline || null,
    title: guardianArticle.fields?.headline || guardianArticle.webTitle,
    description: guardianArticle.fields?.bodyText?.substring(0, 100) + '...' || null,
    url: guardianArticle.webUrl,
    urlToImage: guardianArticle.fields?.thumbnail || null,
    publishedAt: guardianArticle.webPublicationDate,
    content: guardianArticle.fields?.bodyText || null,
})

const convertNYTimesToArticle = (nytArticle: NYTimesArticle): Article => ({
    source: {
        id: 'nytimes',
        name: 'The New York Times',
    },
    author: nytArticle.byline?.original || null,
    title: nytArticle.headline?.main || null,
    description: nytArticle.abstract || nytArticle.snippet || null,
    url: nytArticle.web_url,
    urlToImage: nytArticle.multimedia?.[0]?.url ? `https://static01.nyt.com/${nytArticle.multimedia[0].url}` : null,
    publishedAt: nytArticle.pub_date,
    content: nytArticle.lead_paragraph || null,
})

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
const generateQueryVariations = (query: string): string[] => {
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

const simplifySearchQuery = (query: string): string => {
    return generateQueryVariations(query)[0];
}

const determineTopicFromQuery = (query?: string, category?: string): string => {
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

const convertDomainToNewsAPIFormat = (sources: string): string => {
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

const getOptimizedSourcesForTopic = (topic: string, userSources?: string): string | undefined => {
    if (userSources) return convertDomainToNewsAPIFormat(userSources);

    const topicSources = TOPIC_SPECIFIC_SOURCES[topic as keyof typeof TOPIC_SPECIFIC_SOURCES];
    return topicSources ? convertDomainToNewsAPIFormat(topicSources.join(',')) : undefined;
}

const mapToNYTimesSection = (topic: string): string => {
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

const assessContentQuality = (article: Article, query?: string): QualityScore => {
    // TODO: Remove
    /*let score = 0.5;
    const reasons: string[] = [];
    let isRelevant = true;
    let isProfessional = true;

    const title = (article.title || '').toLowerCase();
    const description = (article.description || '').toLowerCase();
    const sourceName = (article.source?.name || '').toLowerCase();

    const hasLowQualityIndicator = LOW_QUALITY_CONTENT_INDICATORS.some(indicator => title.includes(indicator) || description.includes(indicator));

    if (hasLowQualityIndicator) {
        score -= 0.4;
        isProfessional = false;
        reasons.push('Contains low-quality content indicators');
    }

    const tier1Sources = TRUSTED_NEWS_SOURCES.tier1;
    const tier2Sources = TRUSTED_NEWS_SOURCES.tier2;
    const tier3Sources = TRUSTED_NEWS_SOURCES.tier3;

    if (tier1Sources.some(source => sourceName.includes(source))) {
        score += 0.3;
        reasons.push('Tier 1 trusted source');
    } else if (tier2Sources.some(source => sourceName.includes(source))) {
        score += 0.2;
        reasons.push('Tier 2 reliable source');
    } else if (tier3Sources.some(source => sourceName.includes(source))) {
        score += 0.1;
        reasons.push('Tier 3 acceptable source');
    } else {
        score -= 0.1;
        reasons.push('Unknown source credibility');
    }

    if (title.length < 10) {
        score -= 0.2;
        reasons.push('Title too short');
    }

    if (title.length > 200) {
        score -= 0.1;
        reasons.push('Title too long');
    }

    // Check for clickbait patterns
    const clickbaitPatterns = [
        /you won't believe/i,
        /shocking/i,
        /this will blow your mind/i,
        /number \d+ will surprise you/i,
        /celebrities hate this/i,
        /one weird trick/i,
    ];

    if (clickbaitPatterns.some(pattern => pattern.test(title))) {
        score -= 0.3;
        isProfessional = false;
        reasons.push('Clickbait-style title');
    }

    if (query) {
        const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        let contextualMatches = 0;
        let totalWords = queryWords.length;

        queryWords.forEach(queryWord => {
            const wordPattern = new RegExp(`\\b${queryWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            const titleMatch = wordPattern.test(title);
            const descMatch = wordPattern.test(description);

            if (titleMatch || descMatch) {
                contextualMatches += titleMatch ? 1.5 : 1.0;

                if (titleMatch && title.length > 0) {
                    const titleWords = title.split(/\s+/);
                    const wordIndex = titleWords.findIndex(w => wordPattern.test(w));
                    if (wordIndex >= 0) {
                        const contextWindow = titleWords.slice(Math.max(0, wordIndex - 3), wordIndex + 4);
                        const contextStr = contextWindow.join(' ').toLowerCase();

                        const nearbyMatches = queryWords.filter(qw => qw !== queryWord && contextStr.includes(qw)).length;
                        if (nearbyMatches > 0) {
                            contextualMatches += nearbyMatches * 0.5;
                        }
                    }
                }
            }
        });

        const contextualRelevanceScore = Math.min(1.0, contextualMatches / totalWords);

        if (contextualRelevanceScore < 0.6) {
            score -= 0.4;
            isRelevant = false;
            reasons.push('Low contextual relevance');
        } else if (contextualRelevanceScore > 0.8) {
            score += 0.3;
            reasons.push('High contextual relevance');
        } else if (contextualRelevanceScore > 0.6) {
            score += 0.1;
            reasons.push('Good contextual relevance');
        }
    }

    if (!description || description.length < 50) {
        score -= 0.1;
        reasons.push('Missing or short description');
    }

    if (!article.author && !sourceName.includes('bbc') && !sourceName.includes('reuters')) {
        score -= 0.05;
        reasons.push('No author attribution');
    }

    if (article.publishedAt) {
        const publishDate = new Date(article.publishedAt);
        const daysDiff = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
            score += 0.1;
            reasons.push('Recent article');
        }
    }

    score = Math.max(0, Math.min(1, score));

    return {score, reasons, isRelevant, isProfessional};*/

    let score = 0.5;
    const reasons: string[] = [];
    let isRelevant = true;
    let isProfessional = true;

    const title = article.title?.toLowerCase() || '';
    const sourceName = article.source?.name?.toLowerCase() || '';

    // Source credibility (improved matching)
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

const isDuplicateArticle = (article: Article, existing: Article[]): boolean => {
    /*return existing.some(existingArticle => {
        // URL-based deduplication (exact match)
        if (article.url && existingArticle.url && article.url === existingArticle.url) return true;

        // Title similarity check
        if (article.title && existingArticle.title) {
            const title1 = article.title.toLowerCase().trim().replace(/[^\w\s]/g, '');
            const title2 = existingArticle.title.toLowerCase().trim().replace(/[^\w\s]/g, '');

            // Exact match after normalization
            if (title1 === title2) return true;

            // Check if one title is substantial substring of another
            if (title1.length > 30 && title2.length > 30) {
                const longer = title1.length > title2.length ? title1 : title2;
                const shorter = title1.length > title2.length ? title2 : title1;

                // If shorter is 80%+ of longer, consider duplicate
                if (longer.includes(shorter) && shorter.length / longer.length > 0.8) return true;
            }
        }

        return false;
    });*/

    return existing.some(existingArticle => !!(article.url && existingArticle.url && article.url === existingArticle.url));
}

const fetchNEWSORGTopHeadlines = async ({country, category, sources, q, pageSize = 10, page = 1}: NEWSORGTopHeadlinesParams) => {
    try {
        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing NewsAPI Top Headlines query: "${q}"`.cyan.italic);
            processedQuery = simplifySearchQuery(q.trim());
            console.log(`Query processed: "${q}" → "${processedQuery}"`.green);
        }

        const cacheKey = `${country}-${category}-${sources}-${processedQuery}-${pageSize}-${page}`;
        const cached = TOPHEADLINES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
            console.log('NewsAPIOrg limit reached'.yellow.italic);
            return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
        }

        const {data: topHeadlinesResponse} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
            apis.topHeadlinesApi({country: country || 'us', category, sources, q: processedQuery, pageSize, page}),
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
        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing NewsAPI Everything query: "${q}"`.cyan.italic);

            processedQuery = q.trim();

            console.log(`Query processed: "${q}" → "${processedQuery}"`.green);
        }

        const cacheKey = `${sources}-${from}-${to}-${sortBy}-${language}-${processedQuery}-${pageSize}-${page}`;
        const cached = EVERYTHING_NEWS_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached data:'.cyan.italic, cached.data);
            return cached.data;
        }

        if (newsApiRequestCount >= Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
            console.log('NewsAPIOrg limit reached'.yellow.italic);
            return {status: 'error', message: 'NewsAPIOrg daily limit reached', articles: [], totalResults: 0};
        }

        const {data: everything} = await axios.get<NEWSORGTopHeadlinesAPIResponse>(
            apis.fetchEverythingApi({sources, from, to, sortBy, language, q: processedQuery, pageSize, page}),
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

        if (guardianApiRequestCount >= Number.parseInt(GUARDIAN_QUOTA_REQUESTS!)) {
            console.warn('Guardian API daily limit reached'.yellow.italic);
            return {status: 'error', message: 'Guardian API daily limit reached', articles: [], totalResults: 0};
        }

        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing Guardian query: "${q}"`.cyan.italic);

            processedQuery = simplifySearchQuery(q.trim());

            console.log(`Query processed: "${q}" → "${processedQuery}"`.green);
        }

        const cacheKey = `guardian-${processedQuery}-${section}-${fromDate}-${toDate}-${orderBy}-${pageSize}-${page}`;
        const cached = GUARDIAN_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached Guardian data:'.cyan.italic);
            return cached.data;
        }

        const url = apis.guardianSearchApi({q: processedQuery, section, fromDate, toDate, orderBy, pageSize, page}) + `&api-key=${GUARDIAN_API_KEY}`;
        const {data: guardianResponse} = await axios.get<GuardianResponse>(url, {headers: buildHeader('guardian')});

        guardianApiRequestCount++;
        console.log(`Guardian API request ${guardianApiRequestCount}/${GUARDIAN_QUOTA_REQUESTS}:`.cyan.italic, guardianResponse.response.total, 'results');

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
        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.error('Invalid nytimes section:'.yellow.italic, section);
            return {error: generateInvalidCode('nytimes_section')};
        }

        if (nytimesApiRequestCount >= Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
            console.warn('NYTimes API daily limit reached'.yellow.italic);
            return {status: 'error', message: 'NYTimes API daily limit reached', articles: [], totalResults: 0};
        }

        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing NYTimes query: "${q}"`.cyan.italic);

            processedQuery = simplifySearchQuery(q.trim());

            console.log(`Query processed: "${q}" → "${processedQuery}"`.green);
        }

        const cacheKey = `nytimes-${processedQuery}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
        const cached = NYTIMES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached NYTimes data:'.cyan.italic);
            return cached.data;
        }

        const url = apis.nytimesSearchApi({q: processedQuery, section, sort, fromDate, toDate, pageSize, page}) + `&api-key=${NYTIMES_API_KEY}`;
        const {data: nytResponse} = await axios.get<NYTimesSearchResponse>(url, {headers: buildHeader('nytimes')});
        console.log('Raw NYT search response:', {
            status: nytResponse.status,
            hasResponse: !!nytResponse.response,
            hasDocs: !!nytResponse.response?.docs,
            docsLength: nytResponse.response?.docs?.length,
            metadata: nytResponse.response?.metadata,
        });

        nytimesApiRequestCount++;
        console.log(`NYTimes API request ${nytimesApiRequestCount}/${NYTIMES_QUOTA_REQUESTS}:`.cyan.italic, nytResponse?.response?.metadata?.hits || 0, 'results');

        if (!nytResponse.response || !nytResponse.response.docs) {
            console.warn('NYT API returned invalid response structure'.yellow.italic);
            return {articles: [], totalResults: 0};
        }

        const articles = nytResponse.response.docs.map(convertNYTimesToArticle);
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
        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.error('Invalid nytimes section:'.yellow.italic, section);
            return {error: generateInvalidCode('nytimes_section')};
        }

        if (nytimesApiRequestCount >= Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
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
        console.log(`NYTimes Top Stories API request ${nytimesApiRequestCount}/${NYTIMES_QUOTA_REQUESTS}:`.cyan.italic, nytResponse.num_results, 'results');

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

            const simplifiedQuery = simplifySearchQuery(q.trim());
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

            const allResults = new Map<string, { item: RSSFeed, score: number }>();
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

            console.log(`Expanded search found ${searchResults.length} results for "${q}"`.green);

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
        console.error('ERROR: inside catch of fetchRSSFeed:'.red.bold, error);
        throw error;
    }
}

const smartFetchWithVariations = async (apiFunction: Function, query: string, params: any, minQualityResults: number = 3): Promise<any> => {
    const queryVariations = generateQueryVariations(query);
    console.log(`Trying ${queryVariations.length} query variations:`.cyan.italic, queryVariations);

    for (let i = 0; i < queryVariations.length; i++) {
        const variation = queryVariations[i];
        console.log(`Attempt ${i + 1}: "${variation}"`.yellow);

        try {
            const result = await apiFunction({...params, q: variation});

            if (result && result.articles && result.articles.length > 0) {
                // Apply quality scoring and filtering
                const qualityArticles = result.articles
                    .map((article: Article) => {
                        article.qualityScore = assessContentQuality(article, query); // Use original query for relevance
                        return article;
                    })
                    .filter((article: Article) =>
                        article.qualityScore!.isProfessional &&
                        article.qualityScore!.isRelevant &&
                        article.qualityScore!.score > 0.4
                    );

                console.log(`Variation "${variation}" yielded ${qualityArticles.length} quality articles (from ${result.articles.length} total)`.green);

                if (qualityArticles.length >= minQualityResults) {
                    return {
                        ...result,
                        articles: qualityArticles,
                        usedQuery: variation,
                        originalQuery: query
                    };
                }
            }
        } catch (error: any) {
            console.log(`Variation "${variation}" failed:`.red, error.message);
        }
    }

    console.log(`All query variations failed to produce ${minQualityResults}+ quality results`.yellow.italic);
    return null;
};

const fetchMultiSourceNews = async ({email, q, category, sources, pageSize = 10, page = 1}: MultisourceFetchNewsParams) => {
    console.log('Professional multisource news fetch:'.bgBlue.white.bold, {q, category, sources, pageSize, page});

    const topic = determineTopicFromQuery(q, category);
    const simplifiedQuery = q ? simplifySearchQuery(q) : q;
    const optimizedSources = getOptimizedSourcesForTopic(topic, sources);
    const nytSection = mapToNYTimesSection(topic);

    console.log('Topic:'.cyan, topic);
    console.log('Simplified query:'.cyan, simplifiedQuery);
    console.log('Optimized sources:'.cyan, optimizedSources);
    console.log('NYT section:'.cyan, nytSection);

    const results: Article[] = [];
    const usedSources: string[] = [];
    const errors: string[] = [];

    // NewsAPIOrg (40% of requested articles) with smart query variations
    const newsApiTargetCount = Math.ceil(pageSize * 0.4);
    try {
        if (newsApiRequestCount < Number.parseInt(NEWSAPI_QUOTA_REQUESTS!) && simplifiedQuery) {
            console.log(`Trying NewsAPIOrg with smart query variations (target: ${newsApiTargetCount} articles)...`.cyan.italic);

            const newsApiResult = await smartFetchWithVariations(
                fetchNEWSORGEverything,
                simplifiedQuery,
                {language: 'en', sortBy: 'relevancy', pageSize: newsApiTargetCount * 3, page},
                Math.max(2, Math.ceil(newsApiTargetCount / 2)),
            );

            if (newsApiResult && newsApiResult.articles && newsApiResult.articles.length > 0) {
                const topArticles = newsApiResult.articles
                    .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                    .slice(0, newsApiTargetCount);

                results.push(...topArticles);
                usedSources.push(`NewsAPI (${newsApiResult.usedQuery})`);
                console.log(`NewsAPI contributed ${topArticles.length} quality articles using query: "${newsApiResult.usedQuery}"`.green);
            } else {
                console.log('NewsAPIOrg smart fetch returned no quality articles'.yellow.italic);

                const fallbackResult = await fetchNEWSORGTopHeadlines({
                    country: 'us',
                    category: topic !== 'general' ? topic : undefined,
                    sources: optimizedSources,
                    pageSize: newsApiTargetCount,
                    page
                });

                if (fallbackResult && fallbackResult.articles && fallbackResult.articles.length > 0) {
                    results.push(...fallbackResult.articles.slice(0, newsApiTargetCount));
                    usedSources.push('NewsAPI (fallback)');
                    console.log(`NewsAPI fallback contributed ${Math.min(fallbackResult.articles.length, newsApiTargetCount)} articles`.yellow);
                }
            }
        } else if (!simplifiedQuery) {
            const headlinesResult = await fetchNEWSORGTopHeadlines({
                country: 'us',
                category: topic !== 'general' ? topic : undefined,
                sources: optimizedSources,
                pageSize: newsApiTargetCount,
                page,
            });

            if (headlinesResult && headlinesResult.articles && headlinesResult.articles.length > 0) {
                results.push(...headlinesResult.articles.slice(0, newsApiTargetCount));
                usedSources.push('NewsAPI (headlines)');
                console.log(`NewsAPI headlines contributed ${Math.min(headlinesResult.articles.length, newsApiTargetCount)} articles`.green);
            }
        } else {
            errors.push('NewsAPIOrg limit reached');
            console.log('NewsAPI limit reached, skipping...'.yellow.italic);
        }
    } catch (error: any) {
        errors.push(`NewsAPIOrg failed: ${error.message}`);
        console.log('NewsAPIOrg failed, continuing...'.yellow.italic, error.message);
    }

    // Guardian API (40% of remaining slots)
    const remainingSlots = pageSize - results.length;
    const guardianTargetCount = Math.ceil(remainingSlots * 0.4);

    if (remainingSlots > 0) {
        try {
            if (guardianApiRequestCount < Number.parseInt(GUARDIAN_QUOTA_REQUESTS!) && simplifiedQuery) {
                console.log(`Trying Guardian API with smart variations (target: ${guardianTargetCount} articles)...`.cyan.italic);

                const guardianResult = await smartFetchWithVariations(
                    fetchGuardianNews,
                    simplifiedQuery,
                    {section: topic !== 'general' ? topic : undefined, orderBy: 'relevance', pageSize: guardianTargetCount * 3, page},
                    Math.max(1, Math.ceil(guardianTargetCount / 3)) // Need at least 1 good result
                );

                if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                    const qualityArticles = guardianResult.articles
                        .filter((article: Article) => !isDuplicateArticle(article, results))
                        .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                        .slice(0, guardianTargetCount);

                    results.push(...qualityArticles);
                    usedSources.push(`Guardian (${guardianResult.usedQuery})`);
                    console.log(`Guardian contributed ${qualityArticles.length} quality articles using query: "${guardianResult.usedQuery}"`.green);
                }
            } else if (!simplifiedQuery) {
                const guardianResult = await fetchGuardianNews({
                    section: topic !== 'general' ? topic : undefined,
                    orderBy: 'newest',
                    pageSize: guardianTargetCount,
                    page,
                });

                if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                    const articles = guardianResult.articles
                        .filter((article: Article) => !isDuplicateArticle(article, results))
                        .slice(0, guardianTargetCount);
                    results.push(...articles);
                    usedSources.push('Guardian (section)');
                    console.log(`Guardian section contributed ${articles.length} articles`.green);
                }
            } else {
                errors.push('Guardian API limit reached');
                console.log('Guardian API limit reached, skipping...'.yellow.italic);
            }
        } catch (error: any) {
            errors.push(`Guardian failed: ${error.message}`);
            console.log('Guardian API failed, continuing...'.yellow.italic);
        }
    }

    // NYTimes API (30% of remaining slots)
    const remainingSlots2 = pageSize - results.length;
    const nytimesTargetCount = Math.ceil(remainingSlots2 * 0.3);

    if (remainingSlots2 > 0) {
        try {
            if (nytimesApiRequestCount < Number.parseInt(NYTIMES_QUOTA_REQUESTS!)) {
                console.log(`Trying NYTimes API (target: ${nytimesTargetCount} articles)...`.cyan.italic);

                if (simplifiedQuery) {
                    const nytResult = await smartFetchWithVariations(
                        fetchNYTimesNews,
                        simplifiedQuery,
                        {section: nytSection, sort: 'relevance', pageSize: nytimesTargetCount * 3, page},
                        Math.max(1, Math.ceil(nytimesTargetCount / 3)) // Need at least 1 good result
                    );

                    if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                        const qualityArticles = nytResult.articles
                            .filter((article: Article) => !isDuplicateArticle(article, results))
                            .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                            .slice(0, nytimesTargetCount);

                        results.push(...qualityArticles);
                        usedSources.push(`NYTimes (${nytResult.usedQuery})`);
                        console.log(`NYTimes contributed ${qualityArticles.length} quality articles using query: "${nytResult.usedQuery}"`.green);
                    }
                } else {
                    const nytResult = await fetchNYTimesTopStories({section: nytSection});

                    if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                        const articles = nytResult.articles
                            .filter((article: Article) => !isDuplicateArticle(article, results))
                            .slice(0, nytimesTargetCount);
                        results.push(...articles);
                        usedSources.push('NYTimes (top stories)');
                        console.log(`NYTimes top stories contributed ${articles.length} articles`.green);
                    }
                }
            } else {
                errors.push('NYTimes API limit reached');
                console.log('NYTimes API limit reached, skipping...'.yellow.italic);
            }
        } catch (error: any) {
            errors.push(`NYTimes failed: ${error.message}`);
            console.log('NYTimes API failed, continuing...'.yellow.italic);
        }
    }

    // RSS feeds (fill remaining)
    const remainingSlots3 = pageSize - results.length;

    if (remainingSlots3 > 0) {
        try {
            console.log(`Trying RSS feeds (target: ${remainingSlots3} articles)...`.cyan.italic);

            const rssResults = await fetchAllRSSFeeds({q: simplifiedQuery, sources: optimizedSources, pageSize: remainingSlots3 * 2, page});

            if (rssResults && rssResults.length > 0) {
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

                const qualityArticles = rssArticles
                    .map(article => {
                        article.qualityScore = assessContentQuality(article, q);
                        return article;
                    })
                    .filter(article =>
                        article.qualityScore!.isProfessional &&
                        article.qualityScore!.isRelevant &&
                        article.qualityScore!.score > 0.2 && // Slightly lower threshold for RSS
                        !isDuplicateArticle(article, results)
                    )
                    .sort((a, b) => b.qualityScore!.score - a.qualityScore!.score)
                    .slice(0, remainingSlots3);

                results.push(...qualityArticles);
                usedSources.push('RSS');
                console.log(`RSS contributed ${qualityArticles.length} quality articles (filtered from ${rssArticles.length})`.green);
            }
        } catch (error: any) {
            errors.push(`RSS failed: ${error.message}`);
            console.log('RSS fallback failed, continuing...'.yellow.italic);
        }
    }

    const finalResults = results.sort((a: Article, b: Article) => {
        // Primary sort: Quality score
        const scoreDiff = (b.qualityScore?.score || 0) - (a.qualityScore?.score || 0);
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

        // Secondary sort: Recency for similar scores
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
    }).slice(0, pageSize);

    console.log(`Multisource search completed: ${finalResults.length}/${pageSize} quality articles from [${usedSources.join(', ')}]`.bgGreen.white.bold);

    // Enrich articles with sentiment analysis for logged-in users
    let enrichedArticles = finalResults;
    let sentimentAnalysisEnabled = false;

    if (email) {
        try {
            // Verify user exists
            const {user} = await getUserByEmail({email});
            if (user) {
                console.log('User verified, enriching articles with sentiment analysis...'.cyan.italic);
                console.time('MULTISOURCE_SENTIMENT_ENRICHMENT_TIME'.bgCyan.white.italic);
                enrichedArticles = await SentimentAnalysisService.enrichArticlesWithSentiment(finalResults, true);
                console.timeEnd('MULTISOURCE_SENTIMENT_ENRICHMENT_TIME'.bgCyan.white.italic);
                sentimentAnalysisEnabled = true;
            } else {
                console.log('User not found, skipping sentiment analysis'.yellow.italic);
            }
        } catch (error: any) {
            console.error('Error during user verification or sentiment analysis:'.red.bold, error.message);
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

export {fetchNEWSORGTopHeadlines, fetchNEWSORGEverything, fetchGuardianNews, fetchNYTimesNews, fetchNYTimesTopStories, fetchAllRSSFeeds, fetchMultiSourceNews, scrapeMultipleArticles};
