import "colors";
import {getUserByEmail} from "./AuthService";
import BookmarkModel from "../models/BookmarkSchema";
import {fetchRSSFeed, fetchTopHeadlines} from "./NewsService";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {generateNotFoundCode} from "../utils/generateErrorCodes";
import {GetContentRecommendationsParams, GetContentRecommendationsResponse, RecommendedArticle} from "../types/content-recommendation";
import {sourceMap, SupportedSource} from "../types/news";

const getContentRecommendation = async ({email, pageSize = 10}: GetContentRecommendationsParams): Promise<GetContentRecommendationsResponse> => {
    try {
        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        // Get user data
        const [readingHistory, bookmarks, preferences] = await Promise.all([
            ReadingHistoryModel.find({userExternalId: user.userExternalId}),
            BookmarkModel.find({userExternalId: user.userExternalId}),
            UserPreferenceModel.findOne({userExternalId: user.userExternalId})
        ]);

        // Analyze reading patterns
        const readingSources: SupportedSource[] = readingHistory
            .map(h => extractSourceFromUrl(h.articleUrl))
            .filter((s): s is SupportedSource => s !== null);
        const sourceFrequency = countFrequency(readingSources);
        const readUrls = new Set(readingHistory.map(h => h.articleUrl));

        // Get fresh articles from top sources and preferred categories
        const newsPromises = [];

        const fetchMultiplier = Math.max(2, Math.ceil(pageSize / 5));
        const rssFetchSize = pageSize * fetchMultiplier;
        const categoryFetchSize = Math.ceil(pageSize * fetchMultiplier * 0.75);

        newsPromises.push(fetchRSSFeed({pageSize: rssFetchSize}));

        // Fetch from top reading sources
        const topSources = Object.keys(sourceFrequency).slice(0, 3);
        if (topSources.length > 0) {
            newsPromises.push(fetchRSSFeed({sources: topSources.join(','), pageSize: rssFetchSize}));
        }

        // Fetch from preferred categories if preferences exist
        if (preferences?.preferredCategories?.length) {
            newsPromises.push(fetchTopHeadlines({category: preferences.preferredCategories[0], pageSize: categoryFetchSize}));
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
                    // handle unknown or skip
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
                score += Math.max(0, 24 - hoursOld) / 24; // Higher score for newer articles

                return {
                    ...article,
                    recommendationScore: score,
                    recommendationReason: getRecommendationReason(source, sourceFrequency, preferences, bookmarkedSources)
                };
            })
            .filter((article): article is RecommendedArticle => article !== null)
            .sort((a, b) => b.recommendationScore - a.recommendationScore)
            .slice(0, pageSize);


        if (scoredArticles.length < pageSize) {
            const readArticles = allArticles
                .filter(article => readUrls.has(article.url))
                .map(article => ({...article, recommendationScore: 0.1, recommendationReason: "Previously read"}))
                .slice(0, pageSize - scoredArticles.length);

            scoredArticles.push(...readArticles);
        }

        return {
            recommendations: scoredArticles,
            totalRecommendations: scoredArticles.length,
        };

    } catch (error: any) {
        console.error('ERROR: getRecommendations:', error);
        throw error;
    }
}

// Helper functions
const extractSourceFromUrl = (url: string): SupportedSource | null => {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return sourceMap[domain] ?? null;
    } catch {
        return null;
    }
}

const countFrequency = (items: string[]): { [key: string]: number } => {
    return items.reduce((freq, item) => {
        freq[item] = (freq[item] || 0) + 1;
        return freq;
    }, {} as { [key: string]: number });
}

const getRecommendationReason = (source: string, sourceFrequency: { [key: string]: number }, preferences: any, bookmarkedSources: string[]): string => {
    if (preferences?.preferredSources?.includes(source)) {
        return `From your preferred source: ${source}`;
    }
    if (sourceFrequency[source] >= 3) {
        return `Because you frequently read ${source}`;
    }
    if (bookmarkedSources.includes(source)) {
        return `Similar to articles you bookmarked`;
    }
    return `Trending in your interests`;
}

export {getContentRecommendation};
