import "colors";
import {getUserByEmail} from "./AuthService";
import {RSS_SOURCES} from "../utils/constants";
import BookmarkModel from "../models/BookmarkSchema";
import {sourceMap, SupportedSource} from "../types/news";
import {fetchRSSFeed, fetchTopHeadlines} from "./NewsService";
import {RECOMMENDATION_CACHE_DURATION} from "../config/config";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {GetContentRecommendationsParams, GetContentRecommendationsResponse, RecommendedArticle} from "../types/content-recommendation";

const RECOMMENDATION_CACHE = new Map<string, { data: GetContentRecommendationsResponse, timestamp: number }>();

const getContentRecommendation = async ({email, pageSize = 10}: GetContentRecommendationsParams): Promise<GetContentRecommendationsResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const cacheKey = `${user.userExternalId}-${pageSize}`;
        const cached = RECOMMENDATION_CACHE.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < Number(RECOMMENDATION_CACHE_DURATION)) {
            console.log('Recommendation cache hit:'.green.italic, cacheKey);
            return cached.data;
        }
        console.info('Recommendation cache MISS - fetching fresh:'.bgMagenta.italic, cacheKey);

        // Get user data
        const [readingHistory, bookmarks, preferences] = await Promise.all([
            ReadingHistoryModel.find({userExternalId: user.userExternalId}),
            BookmarkModel.find({userExternalId: user.userExternalId}),
            UserPreferenceModel.findOne({userExternalId: user.userExternalId})
        ]);

        // Determine preferred languages (fallback to English if none set)
        const preferredLanguages = preferences?.newsLanguages?.length
            ? preferences.newsLanguages
            : ['english'];

        // Analyze reading patterns
        const readingSources: SupportedSource[] = readingHistory
            .map(h => extractSourceFromUrl(h.articleUrl))
            .filter((s): s is SupportedSource => s !== null);
        const sourceFrequency = countFrequency(readingSources);
        const readUrls = new Set(readingHistory.map(h => h.articleUrl));

        // Get fresh articles from preferred languages
        const newsPromises = [];
        const fetchMultiplier = Math.max(2, Math.ceil(pageSize / 5));
        const rssFetchSize = Math.ceil(pageSize * fetchMultiplier / preferredLanguages.length);
        const categoryFetchSize = Math.ceil(pageSize * fetchMultiplier * 0.75);

        // Fetch from each preferred language
        preferredLanguages.forEach(language => {
            newsPromises.push(fetchRSSFeed({
                languages: language,
                pageSize: rssFetchSize
            }));
        });

        // Fetch from top reading sources (if any)
        const topSources = Object.keys(sourceFrequency).slice(0, 3);
        if (topSources.length > 0) {
            newsPromises.push(fetchRSSFeed({
                sources: topSources.join(','),
                languages: preferredLanguages.join(','),
                pageSize: rssFetchSize
            }));
        }

        // Fetch from preferred categories (NewsAPI fallback)
        if (preferences?.preferredCategories?.length) {
            newsPromises.push(fetchTopHeadlines({
                category: preferences.preferredCategories[0],
                pageSize: categoryFetchSize
            }));
        }

        const newsResults = await Promise.allSettled(newsPromises);
        const allArticles = newsResults
            .filter(r => r.status === 'fulfilled' && r.value)
            .flatMap(r => (r as any).value);

        // Score and filter articles
        const scoredArticles: RecommendedArticle[] = allArticles
            .filter(article => !(!article.url || readUrls.has(article.url)))
            .map(article => {
                let score = 0;
                const source: SupportedSource | null = extractSourceFromUrl(article.url);
                if (!source) {
                    return null;
                }

                // Boost score for frequently read sources
                if (sourceFrequency[source]) {
                    score += sourceFrequency[source] * 2;
                }

                // Boost score for preferred sources
                if (preferences?.preferredSources?.includes(source)) {
                    score += 3;
                }

                // Boost score for preferred languages
                const articleLanguage = determineArticleLanguage(article.url);
                if (articleLanguage && preferredLanguages.includes(articleLanguage)) {
                    score += 2;
                }

                // Boost score for bookmarked sources
                const bookmarkedSources: SupportedSource[] = bookmarks
                    .map(b => extractSourceFromUrl(b.articleUrl))
                    .filter((s): s is SupportedSource => s !== null);
                if (bookmarkedSources.includes(source)) {
                    score += 2;
                }

                // Recency boost (newer articles get higher scores)
                const articleDate = new Date(article.publishedAt || article.readAt);
                const hoursOld = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);
                score += Math.max(0, 24 - hoursOld) / 24;

                return {
                    ...article,
                    recommendationScore: score,
                    recommendationReason: getRecommendationReason(source, sourceFrequency, preferences, bookmarkedSources, articleLanguage, preferredLanguages)
                };
            })
            .filter((article): article is RecommendedArticle => article !== null)
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, pageSize);

        // Fill remaining slots with previously read articles if needed
        if (scoredArticles.length < pageSize) {
            const readArticles = allArticles
                .filter(article => readUrls.has(article.url))
                .map(article => ({...article, recommendationScore: 0.1, recommendationReason: "Previously read"}))
                .slice(0, pageSize - scoredArticles.length);

            scoredArticles.push(...readArticles);
        }

        const result = {
            recommendations: scoredArticles,
            totalRecommendations: scoredArticles.length,
        };

        RECOMMENDATION_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        return result;
    } catch (error: any) {
        console.error('ERROR: getRecommendations:', error);
        throw error;
    }
}

// Helper functions
const extractSourceFromUrl = (url: string): SupportedSource | null => {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;

    // zeenews
    if (domain === 'zeenews.india.com') {
        if (path.includes('/bengali/')) return 'zeenews_bengali';
        if (path.includes('/hindi/')) return 'zeenews_hindi';
        return 'zeenews_india';
    }

    // prothomalp
    if (domain === 'prothomalo.com') {
        return 'prothom_alo'; // Bengali version
    }
    if (domain === 'prod-qt-images.s3.amazonaws.com' && path.includes('prothomalo-english')) {
        return 'prothom_alo_english';
    }

    // bbcnews
    if (domain === 'bbc.github.io') {
        if (path.includes('/bengali')) return 'bbc_news_bengali';
        if (path.includes('/hindi')) return 'bbc_news_hindi';
        return 'bbc_news_bengali';
    }

    return sourceMap[domain] ?? null;
}

const countFrequency = (items: string[]): { [key: string]: number } => {
    return items.reduce((freq, item) => {
        freq[item] = (freq[item] || 0) + 1;
        return freq;
    }, {} as { [key: string]: number });
}

const determineArticleLanguage = (url: string): string | null => {
    try {
        const domain = new URL(url).hostname.replace('www.', '');

        // Check each language in RSS_SOURCES
        for (const [language, sources] of Object.entries(RSS_SOURCES)) {
            for (const [sourceName, sourceUrl] of Object.entries(sources)) {
                try {
                    const sourceDomain = new URL(sourceUrl).hostname.replace('www.', '');
                    if (domain === sourceDomain) {
                        return language;
                    }
                } catch {

                }
            }
        }

        // Default fallback
        return 'english';
    } catch {
        return null;
    }
}

const getRecommendationReason = (source: string, sourceFrequency: { [key: string]: number },
                                 preferences: any, bookmarkedSources: string[], articleLanguage: string | null, preferredLanguages: string[]): string => {
    if (preferences?.preferredSources?.includes(source)) {
        return `From your preferred source: ${source}`;
    }
    if (articleLanguage && preferredLanguages.includes(articleLanguage)) {
        return `In your preferred language: ${articleLanguage}`;
    }
    if (sourceFrequency[source] >= 3) {
        return `Because you frequently read ${source}`;
    }
    if (bookmarkedSources.includes(source)) {
        return `Similar to articles you bookmarked`;
    }
    return `Trending in your interests`;
}

const clearRecommendationCache = (userExternalId: string) => {
    console.info('clearRecommendationCache called:'.bgMagenta.white.italic, userExternalId);
    console.log('Current cache keys:'.yellow, Array.from(RECOMMENDATION_CACHE.keys()));

    let deletedCount = 0;
    for (const [key] of RECOMMENDATION_CACHE) {
        if (key.startsWith(userExternalId)) {
            RECOMMENDATION_CACHE.delete(key);
            deletedCount++;
            console.log('Deleted cache key:'.red, key);
        }
    }
    console.log(`Deleted ${deletedCount} cache entries for user:`.green, userExternalId);
}

export {getContentRecommendation, clearRecommendationCache};
