import "colors";
import AuthService from "./AuthService";
import NewsService from "./NewsService";
import {RSS_SOURCES} from "../utils/constants";
import {IArticle, TSupportedSource} from "../types/news";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {IGetContentRecommendationsParams, IGetContentRecommendationsResponse, IRecommendedArticle} from "../types/content-recommendation";

class ContentRecommendationService {
    private static readonly SOURCE_LOOKUP_MAP: Map<string, string> = (() => {
        const map = new Map<string, string>();

        Object.entries(RSS_SOURCES).forEach(([_language, sources]) => {
            Object.entries(sources).forEach(([sourceName, sourceUrl]) => {
                try {
                    const url = new URL(sourceUrl);
                    const domain = url.hostname.replace('www.', '');

                    if (!map.has(domain)) {
                        map.set(domain, sourceName);
                    }
                } catch (error: any) {
                }
            });
        });

        return map;
    })();

    /**
     * Get personalized content recommendations based on user preferences and reading history
     */
    static async getContentRecommendation({email, pageSize = 10}: IGetContentRecommendationsParams): Promise<IGetContentRecommendationsResponse> {
        console.log('Service: ContentRecommendationService.getContentRecommendation called'.cyan.italic, {email, pageSize});

        try {
            if (!email) {
                console.warn('Client Error: Missing email parameter'.yellow);
                return {error: generateMissingCode('email')};
            }

            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const [preferences, readingHistory] = await Promise.all([
                UserPreferenceModel.findOne({userExternalId: user.userExternalId}),
                ReadingHistoryModel.find({userExternalId: user.userExternalId}).sort({createdAt: -1}).limit(50),
            ]);
            console.log('Database: User data fetched'.cyan, {hasPreferences: !!preferences, readingHistoryCount: readingHistory.length});

            const historicalSources = this.extractSourcesFromHistory(readingHistory);
            console.log('Database: Extracted historical sources'.cyan, {historicalSources});

            const newsPromises: Promise<any>[] = [];
            const reasons: string[] = [];

            if (preferences?.preferredCategories?.length || preferences?.newsLanguages?.length) {
                const category = preferences.preferredCategories?.[0];

                console.log('Service: Fetching news based on preferences'.cyan, {category, languages: preferences.newsLanguages});

                newsPromises.push(
                    NewsService.fetchMultiSourceNewsEnhanced({
                        email,
                        category,
                        pageSize: Math.ceil(pageSize * 0.6),
                    }),
                );

                if (category) reasons.push(`Based on your preferred category: ${category}`);
                if (preferences.newsLanguages?.length) reasons.push(`In your preferred language`);
            }

            if (historicalSources.length > 0) {
                const sourcesParam = historicalSources.slice(0, 3).join(',');
                console.log('Service: Fetching news based on reading history'.cyan, {sources: sourcesParam});

                newsPromises.push(
                    NewsService.fetchMultiSourceNewsEnhanced({
                        email,
                        sources: sourcesParam,
                        pageSize: Math.ceil(pageSize * 0.4),
                    }),
                );

                reasons.push('Based on sources you\'ve read before');
            }

            if (newsPromises.length === 0) {
                console.log('Service: No preferences or history found, fetching default news'.cyan);
                newsPromises.push(
                    NewsService.fetchMultiSourceNewsEnhanced({email, pageSize}),
                );
                reasons.push('Trending news');
            }

            const newsResults = await Promise.allSettled(newsPromises);
            console.log('External API: News fetched from multiple sources'.magenta, {totalRequests: newsResults.length, successful: newsResults.filter(r => r.status === 'fulfilled').length});

            const allArticles: IArticle[] = [];
            newsResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value?.articles) {
                    allArticles.push(...result.value.articles);
                }
            });
            console.log('Service: Combined articles from all sources'.cyan, {totalArticles: allArticles.length});

            const seenUrls = new Set<string>();
            const uniqueArticles = allArticles.filter(article => {
                if (!article.url || seenUrls.has(article.url)) {
                    return false;
                }
                seenUrls.add(article.url);
                return true;
            });
            console.log('Service: Filtered duplicate articles'.cyan, {beforeFilter: allArticles.length, afterFilter: uniqueArticles.length});

            uniqueArticles.sort((a, b) => {
                const dateA = new Date(a.publishedAt || 0).getTime();
                const dateB = new Date(b.publishedAt || 0).getTime();
                return dateB - dateA;
            });
            console.log('Service: Sorted articles by date'.cyan);

            const recommendations = uniqueArticles
                .slice(0, pageSize)
                .map((article, index) => ({
                    ...article,
                    recommendationScore: uniqueArticles.length - index,
                    recommendationReason: this.determineRecommendationReason(article, preferences, historicalSources, reasons),
                })) as IRecommendedArticle[];

            console.log('Content recommendations generated successfully'.green.bold, {totalRecommendations: recommendations.length});

            return {recommendations, totalRecommendations: recommendations.length};
        } catch (error: any) {
            console.error('Service Error: ContentRecommendationService.getContentRecommendation failed:'.red.bold, error);
            throw error;
        }
    }

    /**
     * Extract unique sources from reading history
     */
    private static extractSourcesFromHistory(readingHistory: any[]): TSupportedSource[] {
        const sourceFrequency = new Map<string, number>();

        readingHistory.forEach(entry => {
            if (entry.articleUrl) {
                const source = this.extractSourceFromUrl(entry.articleUrl);
                if (source) {
                    sourceFrequency.set(source, (sourceFrequency.get(source) || 0) + 1);
                }
            }
        });

        return Array.from(sourceFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([source]) => source as TSupportedSource);
    }

    /**
     * Extract source identifier from article URL using pre-built lookup map
     */
    private static extractSourceFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');

            const source = this.SOURCE_LOOKUP_MAP.get(domain);
            if (source) {
                return source;
            }

            if (domain.includes('theguardian.com') || domain.includes('guardian.co.uk')) {
                return 'guardian';
            }
            if (domain.includes('nytimes.com')) {
                return 'nytimes';
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Determine recommendation reason for an article
     */
    private static determineRecommendationReason(article: IArticle, preferences: any, historicalSources: string[], defaultReasons: string[]): string {
        const source = this.extractSourceFromUrl(article.url || '');

        if (source && preferences?.preferredSources?.includes(source)) {
            return `From your preferred source: ${source}`;
        }

        if (source && historicalSources.includes(source)) {
            return `From a source you read frequently`;
        }

        return defaultReasons[0] || 'Trending news';
    }
}

export default ContentRecommendationService;
