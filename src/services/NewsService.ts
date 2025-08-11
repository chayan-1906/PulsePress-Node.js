import "colors";
import axios from "axios";
import Fuse from "fuse.js";
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {apis} from "../utils/apis";
import {isListEmpty} from "../utils/list";
import {parseRSS} from "../utils/parseRSS";
import StrikeService from "./StrikeService";
import {expandQueryWithAI} from "./AIService";
import {buildHeader} from "../utils/buildHeader";
import NewsClassificationService from "./NewsClassificationService";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";
import {COMPREHENSIVE_TOPIC_KEYWORDS, LOW_QUALITY_CONTENT_INDICATORS, RSS_SOURCES, TOPIC_SPECIFIC_SOURCES, TRUSTED_NEWS_SOURCES, USER_AGENTS} from "../utils/constants";
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
        name: 'The Guardian'
    },
    author: guardianArticle.fields?.byline || null,
    title: guardianArticle.fields?.headline || guardianArticle.webTitle,
    description: guardianArticle.fields?.bodyText?.substring(0, 200) + '...' || null,
    url: guardianArticle.webUrl,
    urlToImage: guardianArticle.fields?.thumbnail || null,
    publishedAt: guardianArticle.webPublicationDate,
    content: guardianArticle.fields?.bodyText || null
})

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
})

const enhanceSearchQuery = (query: string): string => {
    if (!query) return query;

    const lowerQuery = query.toLowerCase().trim();

    // Use COMPREHENSIVE_TOPIC_KEYWORDS for better enhancement
    for (const [topic, keywords] of Object.entries(COMPREHENSIVE_TOPIC_KEYWORDS)) {
        if (keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
            return `${query} ${keywords.slice(0, 3).join(' ')}`; // Add top 3 relevant keywords
        }
    }

    // Legacy sport-specific enhancements (keep as fallback)
    if (/cricket|test.*match|ind.*eng|eng.*ind|india.*england|england.*india|series/i.test(lowerQuery)) {
        return `${query} cricket sport match series team`;
    }
    if (/football|soccer|premier.*league|champions.*league|fifa/i.test(lowerQuery)) {
        return `${query} football soccer sport match team`;
    }
    if (/basketball|nba|playoff|finals/i.test(lowerQuery)) {
        return `${query} basketball sport nba team game`;
    }
    if (/tennis|wimbledon|us.*open|australian.*open|french.*open/i.test(lowerQuery)) {
        return `${query} tennis sport tournament match`;
    }

    // Business/Finance enhancements
    if (/stock|market|economy|finance|business|earnings|profit/i.test(lowerQuery)) {
        return `${query} business economy finance market`;
    }

    // Technology enhancements
    if (/tech|ai|startup|software|hardware|digital/i.test(lowerQuery)) {
        return `${query} technology tech innovation`;
    }

    // Health enhancements
    if (/health|medical|disease|treatment|vaccine|medicine/i.test(lowerQuery)) {
        return `${query} health medical medicine`;
    }

    // Politics enhancements
    if (/politics|government|election|policy|parliament|congress/i.test(lowerQuery)) {
        return `${query} politics government policy`;
    }

    // Science enhancements
    if (/science|research|study|climate|environment|space/i.test(lowerQuery)) {
        return `${query} science research study`;
    }

    return query;
}

const determineTopicFromQuery = (query?: string, category?: string): string => {
    if (category) return category;
    if (!query) return 'general';

    const lowerQuery = query.toLowerCase();

    // Use COMPREHENSIVE_TOPIC_KEYWORDS for better detection
    for (const [topic, keywords] of Object.entries(COMPREHENSIVE_TOPIC_KEYWORDS)) {
        if (keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()))) {
            // Map some topics to broader categories
            if (topic === 'cricket' || topic === 'football' || topic === 'basketball') return 'sports';
            if (topic === 'finance') return 'business';
            if (topic === 'social_media') return 'technology';
            if (topic === 'celebrity' || topic === 'music') return 'entertainment';
            if (topic === 'crime') return 'general';
            return topic;
        }
    }

    // Legacy fallback detection
    if (/sport|match|game|team|player|football|basketball|tennis/i.test(lowerQuery)) return 'sports';
    if (/business|economy|market|finance|stock|trade|company/i.test(lowerQuery)) return 'business';
    if (/tech|technology|ai|software|startup|digital|cyber/i.test(lowerQuery)) return 'technology';
    if (/health|medical|medicine|disease|treatment|doctor/i.test(lowerQuery)) return 'health';
    if (/science|research|study|climate|environment|space/i.test(lowerQuery)) return 'science';
    if (/politics|government|election|policy|parliament|law/i.test(lowerQuery)) return 'politics';

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
    let score = 0.5;
    const reasons: string[] = [];
    let isRelevant = true;
    let isProfessional = true;

    const title = (article.title || '').toLowerCase();
    const description = (article.description || '').toLowerCase();
    const sourceName = (article.source?.name || '').toLowerCase();
    const content = `${title} ${description}`.toLowerCase();

    // Check for low-quality content indicators
    const hasLowQualityIndicator = LOW_QUALITY_CONTENT_INDICATORS.some(indicator => title.includes(indicator) || description.includes(indicator));

    if (hasLowQualityIndicator) {
        score -= 0.4;
        isProfessional = false;
        reasons.push('Contains low-quality content indicators');
    }

    // Source credibility assessment
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

    // Title quality checks
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
        /one weird trick/i
    ];

    if (clickbaitPatterns.some(pattern => pattern.test(title))) {
        score -= 0.3;
        isProfessional = false;
        reasons.push('Clickbait-style title');
    }

    // Query relevance assessment
    if (query) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const matchCount = queryWords.filter(word => word.length > 2 && (title.includes(word) || description.includes(word))).length;

        const relevanceScore = matchCount / queryWords.length;

        if (relevanceScore < 0.2) {
            score -= 0.3;
            isRelevant = false;
            reasons.push('Low query relevance');
        } else if (relevanceScore > 0.6) {
            score += 0.2;
            reasons.push('High query relevance');
        }
    }

    // Content completeness
    if (!description || description.length < 50) {
        score -= 0.1;
        reasons.push('Missing or short description');
    }

    if (!article.author && !sourceName.includes('bbc') && !sourceName.includes('reuters')) {
        score -= 0.05;
        reasons.push('No author attribution');
    }

    // Recency boost (articles from last 7 days get slight boost)
    if (article.publishedAt) {
        const publishDate = new Date(article.publishedAt);
        const daysDiff = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
            score += 0.1;
            reasons.push('Recent article');
        }
    }

    // Normalize score to 0-1 range
    score = Math.max(0, Math.min(1, score));

    return {score, reasons, isRelevant, isProfessional};
}

const isDuplicateArticle = (article: Article, existing: Article[]): boolean => {
    return existing.some(existingArticle => {
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
    });
}

const fetchNEWSORGTopHeadlines = async ({email, country, category, sources, q, pageSize = 10, page = 1}: NEWSORGTopHeadlinesParams) => {
    try {
        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing NewsAPI Top Headlines query: "${q}"`.cyan.italic);

            try {
                if (email) {
                    console.log('Attempting AI query expansion...'.cyan.italic);

                    const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
                    if (isBlocked) {
                        console.log('User is currently blocked, using basic expansion...'.yellow.italic, {message, blockedUntil, blockType});

                        processedQuery = enhanceSearchQuery(q.trim());
                        console.log('Block detected, falling back to basic query enhancement'.yellow.italic);
                    } else {
                        console.log('Checking if query is news-related before AI expansion...'.cyan.italic);
                        const classification = await NewsClassificationService.classifyContent(q.trim());

                        if (classification === 'error') {
                            console.error('Classification failed, allowing AI expansion to proceed'.yellow.italic);
                            const expandedTerms = await expandQueryWithAI({email, query: q.trim()});
                            processedQuery = expandedTerms.join(' ');
                        } else if (classification === 'non_news') {
                            console.log('Non-news query detected, applying strike and using basic expansion...'.yellow.italic);

                            await StrikeService.applyStrike(email);

                            processedQuery = enhanceSearchQuery(q.trim());

                            console.log('Strike applied, falling back to basic query enhancement'.yellow.italic);
                        } else {
                            console.log('News query verified, proceeding with AI expansion...'.green.italic);
                            const expandedTerms = await expandQueryWithAI({email, query: q.trim()});
                            processedQuery = expandedTerms.join(' ');
                        }
                    }
                } else {
                    console.log('Anonymous users can\'t use AI features, using basic expansion...'.yellow.italic);
                    processedQuery = enhanceSearchQuery(q.trim());
                }
            } catch (error) {
                console.log('AI expansion failed, using basic search...'.yellow.italic);

                const topic = determineTopicFromQuery(q);
                const topicKeywords = COMPREHENSIVE_TOPIC_KEYWORDS[topic as keyof typeof COMPREHENSIVE_TOPIC_KEYWORDS] || [];
                processedQuery = [q.trim(), ...topicKeywords.slice(0, 3)].join(' ');
            }

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

const fetchNEWSORGEverything = async ({email, sources, from, to, sortBy, language, q, pageSize = 10, page = 1}: NEWSORGEverythingParams) => {
    try {
        let processedQuery = q;

        if (q && q.trim()) {
            console.log(`Processing NewsAPI Everything query: "${q}"`.cyan.italic);

            try {
                if (email) {
                    console.log('Attempting AI query expansion...'.cyan.italic);

                    const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
                    if (isBlocked) {
                        console.log('User is currently blocked, using basic expansion...'.yellow.italic, {message, blockedUntil, blockType});
                        processedQuery = enhanceSearchQuery(q.trim());
                        console.log('Block detected, falling back to basic query enhancement'.yellow.italic);
                    } else {
                        console.log('Checking if query is news-related before AI expansion...'.cyan.italic);
                        const classification = await NewsClassificationService.classifyContent(q.trim());

                        if (classification === 'error') {
                            console.error('Classification failed, allowing AI expansion to proceed'.yellow.italic);
                            const expandedTerms = await expandQueryWithAI({email, query: q.trim()});

                            if (expandedTerms.length > 1) {
                                const primaryTerm = `"${expandedTerms[0]}"`;
                                const secondaryTerms = expandedTerms.slice(1, 3);
                                processedQuery = `${primaryTerm} ${secondaryTerms.join(' ')}`;
                            } else {
                                processedQuery = `"${expandedTerms[0]}"`;
                            }
                        } else if (classification === 'non_news') {
                            console.log('Non-news query detected, applying strike and using basic expansion...'.yellow.italic);
                            await StrikeService.applyStrike(email);
                            processedQuery = enhanceSearchQuery(q.trim());
                            console.log('Strike applied, falling back to basic query enhancement'.yellow.italic);
                        } else {
                            console.log('News query verified, proceeding with AI expansion...'.green.italic);
                            const expandedTerms = await expandQueryWithAI({email, query: q.trim()});

                            if (expandedTerms.length > 1) {
                                const primaryTerm = `"${expandedTerms[0]}"`;
                                const secondaryTerms = expandedTerms.slice(1, 3);
                                processedQuery = `${primaryTerm} ${secondaryTerms.join(' ')}`;
                            } else {
                                processedQuery = `"${expandedTerms[0]}"`;
                            }
                        }
                    }
                } else {
                    console.log('Anonymous users can\'t use AI features, using basic expansion...'.yellow.italic);
                    processedQuery = `"${q.trim()}"`;
                }
            } catch (error) {
                console.log('AI expansion failed, using basic search...'.yellow.italic);
                processedQuery = `"${q.trim()}"`;
            }

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

const fetchGuardianNews = async ({email, q, section, fromDate, toDate, orderBy = 'newest', pageSize = 10, page = 1}: GuardianSearchParams) => {
    try {
        if (!GUARDIAN_API_KEY) {
            console.warn('Guardian API key not configured'.yellow.italic);
            return {articles: [], totalResults: 0};
        }

        if (guardianApiRequestCount >= Number.parseInt(GUARDIAN_QUOTA_REQUESTS!)) {
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

const fetchNYTimesNews = async ({email, q, section, sort = 'newest', fromDate, toDate, pageSize = 10, page = 1}: NYTimesSearchParams) => {
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

        const cacheKey = `nytimes-${q}-${section}-${sort}-${fromDate}-${toDate}-${pageSize}-${page}`;
        const cached = NYTIMES_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('returning cached NYTimes data:'.cyan.italic);
            return cached.data;
        }

        const url = apis.nytimesSearchApi({q, section, sort, fromDate, toDate, pageSize, page}) + `&api-key=${NYTIMES_API_KEY}`;
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

const fetchNYTimesTopStories = async ({email, section = 'home'}: NYTimesTopStoriesParams) => {
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

const fetchAllRSSFeeds = async ({email, q, sources, languages = 'english', pageSize = 10, page = 1}: RSSFeedParams) => {
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
            console.log(`Searching RSS feeds with query expansion for: "${q}"`.cyan.italic);

            let expandedTerms: string[];

            try {
                if (email) {
                    console.log('Attempting AI query expansion...'.cyan.italic);

                    const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
                    if (isBlocked) {
                        console.log('User is currently blocked, using basic expansion...'.yellow.italic, {message, blockedUntil, blockType});

                        const enhancedQuery = enhanceSearchQuery(q.trim());
                        expandedTerms = enhancedQuery.split(' ').filter(term => term.length > 2);
                        console.log('Block detected, falling back to basic query enhancement'.yellow.italic);
                    } else {
                        console.log('Checking if query is news-related before AI expansion...'.cyan.italic);
                        const classification = await NewsClassificationService.classifyContent(q.trim());

                        if (classification === 'error') {
                            console.error('Classification failed, allowing AI expansion to proceed'.yellow.italic);
                            expandedTerms = await expandQueryWithAI({email, query: q.trim()});
                        } else if (classification === 'non_news') {
                            console.log('Non-news query detected, applying strike and using basic expansion...'.yellow.italic);

                            // Apply strike for non-news query
                            await StrikeService.applyStrike(email);

                            // Use basic enhancement instead of AI expansion
                            const enhancedQuery = enhanceSearchQuery(q.trim());
                            expandedTerms = enhancedQuery.split(' ').filter(term => term.length > 2);

                            console.log('Strike applied, falling back to basic query enhancement'.yellow.italic);
                        } else {
                            console.log('News query verified, proceeding with AI expansion...'.green.italic);
                            expandedTerms = await expandQueryWithAI({email, query: q.trim()});
                        }
                    }
                } else {
                    console.log('Anonymous users can\'t use AI features, using basic expansion...'.yellow.italic);

                    const enhancedQuery = enhanceSearchQuery(q.trim());
                    expandedTerms = enhancedQuery.split(' ').filter(term => term.length > 2);
                }
            } catch (error) {
                console.log('AI expansion failed, using basic search...'.yellow.italic);
                // Enhanced basic expansion using keywords
                const topic = determineTopicFromQuery(q);
                const topicKeywords = COMPREHENSIVE_TOPIC_KEYWORDS[topic as keyof typeof COMPREHENSIVE_TOPIC_KEYWORDS] || [];
                expandedTerms = [q.trim(), ...topicKeywords.slice(0, 3)];
            }

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

const fetchMultiSourceNews = async ({email, q, category, sources, pageSize = 10, page = 1}: MultisourceFetchNewsParams) => {
    console.log('Professional multisource news fetch:'.bgBlue.white.bold, {q, category, sources, pageSize, page});

    const topic = determineTopicFromQuery(q, category);
    const enhancedQuery = q ? enhanceSearchQuery(q) : q;
    const optimizedSources = getOptimizedSourcesForTopic(topic, sources);
    const nytSection = mapToNYTimesSection(topic);

    console.log('Topic:'.cyan, topic);
    console.log('Enhanced query:'.cyan, enhancedQuery);
    console.log('Optimized sources:'.cyan, optimizedSources);
    console.log('NYT section:'.cyan, nytSection);

    const results: Article[] = [];
    const usedSources: string[] = [];
    const errors: string[] = [];

    // NewsAPIOrg (40% of requested articles)
    const newsApiTargetCount = Math.ceil(pageSize * 0.4);
    try {
        if (newsApiRequestCount < Number.parseInt(NEWSAPI_QUOTA_REQUESTS!)) {
            console.log(`Trying NewsAPIOrg (target: ${newsApiTargetCount} articles)...`.cyan.italic);

            let newsApiResult;
            if (enhancedQuery) {
                newsApiResult = await fetchNEWSORGEverything({q: enhancedQuery, language: 'en', sortBy: 'relevancy', pageSize: newsApiTargetCount * 2, page});
            } else {
                newsApiResult = await fetchNEWSORGTopHeadlines({country: 'us', category: topic !== 'general' ? topic : undefined, sources: optimizedSources, pageSize: newsApiTargetCount * 2, page});
            }
            console.log('everything from NewsAPIOrg:'.cyan.italic, newsApiResult);

            if (newsApiResult && newsApiResult.articles && newsApiResult.articles.length > 0) {
                const qualityArticles = newsApiResult.articles
                    .map((article: Article) => {
                        article.qualityScore = assessContentQuality(article, q);
                        return article;
                    })
                    .filter((article: Article) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.3)
                    .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                    .slice(0, newsApiTargetCount);

                results.push(...qualityArticles);
                usedSources.push('NewsAPI');
                console.log(`NewsAPI contributed ${qualityArticles.length} quality articles (filtered from ${newsApiResult.articles.length})`.green);
            } else {
                console.log('NewsAPIOrg returned no articles'.yellow.italic);
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
            if (guardianApiRequestCount < Number.parseInt(GUARDIAN_QUOTA_REQUESTS!)) {
                console.log(`Trying Guardian API (target: ${guardianTargetCount} articles)...`.cyan.italic);

                const guardianResult = await fetchGuardianNews({
                    q: enhancedQuery,
                    section: topic !== 'general' ? topic : undefined,
                    orderBy: enhancedQuery ? 'relevance' : 'newest',
                    pageSize: guardianTargetCount * 2,
                    page
                });

                if (guardianResult && guardianResult.articles && guardianResult.articles.length > 0) {
                    const qualityArticles = guardianResult.articles
                        .map((article: Article) => {
                            article.qualityScore = assessContentQuality(article, q);
                            return article;
                        })
                        .filter((article: Article) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.3 && !isDuplicateArticle(article, results))
                        .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                        .slice(0, guardianTargetCount);

                    results.push(...qualityArticles);
                    usedSources.push('Guardian');
                    console.log(`Guardian contributed ${qualityArticles.length} quality articles (filtered from ${guardianResult.articles.length})`.green);
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

                const nytResult = enhancedQuery
                    ? await fetchNYTimesNews({q: enhancedQuery, section: nytSection, sort: 'relevance', pageSize: nytimesTargetCount * 2, page})
                    : await fetchNYTimesTopStories({section: nytSection});

                if (nytResult && nytResult.articles && nytResult.articles.length > 0) {
                    const qualityArticles = nytResult.articles
                        .map((article: Article) => {
                            article.qualityScore = assessContentQuality(article, q);
                            return article;
                        })
                        .filter((article: Article) => article.qualityScore!.isProfessional && article.qualityScore!.isRelevant && article.qualityScore!.score > 0.3 && !isDuplicateArticle(article, results))
                        .sort((a: Article, b: Article) => b.qualityScore!.score - a.qualityScore!.score)
                        .slice(0, nytimesTargetCount);

                    results.push(...qualityArticles);
                    usedSources.push('NYTimes');
                    console.log(`NYTimes contributed ${qualityArticles.length} quality articles (filtered from ${nytResult.articles.length})`.green);
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

            const rssResults = await fetchAllRSSFeeds({email, q: enhancedQuery, sources: optimizedSources, pageSize: remainingSlots3 * 2, page});

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

    // Quality sort and limit
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

    return {
        totalResults: finalResults.length,
        query: q,
        articles: finalResults,
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
