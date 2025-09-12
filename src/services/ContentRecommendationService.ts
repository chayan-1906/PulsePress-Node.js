import "colors";
import AuthService from "./AuthService";
import NewsService from "./NewsService";
import {RSS_SOURCES} from "../utils/constants";
import AnalyticsService from "./AnalyticsService";
import BookmarkModel from "../models/BookmarkSchema";
import {sourceMap, TSupportedSource} from "../types/news";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {RECOMMENDATION_CACHE_DURATION} from "../config/config";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {IGetContentRecommendationsParams, IGetContentRecommendationsResponse, IRecommendedArticle} from "../types/content-recommendation";

// TODO: Convert this to class-based

const RECOMMENDATION_CACHE = new Map<string, { data: IGetContentRecommendationsResponse, timestamp: number }>();

const CATEGORY_MAPPING: { [key: string]: { guardian?: string, nytimes?: string } } = {
    'business': {guardian: 'business', nytimes: 'business'},
    'entertainment': {guardian: 'culture', nytimes: 'arts'},
    'general': {guardian: 'world', nytimes: 'world'},
    'health': {guardian: 'lifeandstyle', nytimes: 'health'},
    'science': {guardian: 'science', nytimes: 'science'},
    'sports': {guardian: 'sport', nytimes: 'sports'},
    'technology': {guardian: 'technology', nytimes: 'technology'},
    'country': {guardian: 'world', nytimes: 'world'},
};

const getContentRecommendation = async ({email, pageSize = 5}: IGetContentRecommendationsParams): Promise<IGetContentRecommendationsResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const {user} = await AuthService.getUserByEmail({email});
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
        const [readingHistory, bookmarks, preferences, topSources] = await Promise.all([
            ReadingHistoryModel.find({userExternalId: user.userExternalId}),
            BookmarkModel.find({userExternalId: user.userExternalId}),
            UserPreferenceModel.findOne({userExternalId: user.userExternalId}),
            AnalyticsService.getTopPerformingSources({limit: 5, minViews: 5}),
        ]);

        // Determine preferred languages (fallback to English if none set)
        const preferredLanguages = preferences?.newsLanguages?.length ? preferences.newsLanguages : ['english'];

        // Analyze reading patterns
        const readingSources: TSupportedSource[] = readingHistory
            .map(h => extractSourceFromUrl(h.articleUrl))
            .filter((s): s is TSupportedSource => s !== null);
        const sourceFrequency = countFrequency(readingSources);
        const readUrls = new Set(readingHistory.map(h => h.articleUrl));

        // Get top performing sources for boosting
        const topPerformingSources = topSources.topSources?.map(s => s.source) || [];

        // Get fresh articles from preferred languages
        const newsPromises = [];
        const fetchMultiplier = Math.max(2, Math.ceil(pageSize / 5));
        const rssFetchSize = Math.ceil(pageSize * fetchMultiplier / preferredLanguages.length);
        const categoryFetchSize = Math.ceil(pageSize * fetchMultiplier * 0.75);
        const apiSourceFetchSize = Math.ceil(pageSize * fetchMultiplier * 0.5); // For Guardian and NYTimes

        // Fetch from each preferred language
        preferredLanguages.forEach(language => {
            newsPromises.push(NewsService.fetchAllRssFeeds({
                languages: language,
                pageSize: rssFetchSize,
            }));
        });

        // Prioritize top performing sources
        const topSourcesToFetch = topPerformingSources.slice(0, 3);
        if (topSourcesToFetch.length > 0) {
            newsPromises.push(NewsService.fetchAllRssFeeds({
                sources: topSourcesToFetch.join(','),
                languages: preferredLanguages.join(','),
                pageSize: rssFetchSize,
            }));
        }

        // Fetch from user's frequently read sources (if different from top performing)
        const topUserSources = Object.keys(sourceFrequency).slice(0, 3);
        const uniqueUserSources = topUserSources.filter(s => !topSourcesToFetch.includes(s));
        if (uniqueUserSources.length > 0) {
            newsPromises.push(NewsService.fetchAllRssFeeds({
                sources: uniqueUserSources.join(','),
                languages: preferredLanguages.join(','),
                pageSize: rssFetchSize,
            }));
        }

        // Fetch from preferred categories across all news sources
        if (preferences?.preferredCategories?.length) {
            const primaryCategory = preferences.preferredCategories[0];

            // NewsAPI.Org
            newsPromises.push(NewsService.fetchNewsApiOrgTopHeadlines({
                category: primaryCategory,
                pageSize: categoryFetchSize,
            }));

            // Guardian - map category and fetch
            const guardianSection = CATEGORY_MAPPING[primaryCategory]?.guardian;
            if (guardianSection) {
                newsPromises.push(NewsService.fetchGuardianNews({
                    section: guardianSection,
                    pageSize: apiSourceFetchSize,
                    orderBy: 'newest',
                }));
            }

            // NYTimes - map category and fetch top stories
            const nytimesSection = CATEGORY_MAPPING[primaryCategory]?.nytimes;
            if (nytimesSection) {
                newsPromises.push(NewsService.fetchNewYorkTimesTopStories({
                    section: nytimesSection,
                }));
            }

            // If there's a second preferred category, fetch from Guardian and NYTimes for that too
            if (preferences.preferredCategories.length > 1) {
                const secondaryCategory = preferences.preferredCategories[1];

                const guardianSecondarySection = CATEGORY_MAPPING[secondaryCategory]?.guardian;
                if (guardianSecondarySection) {
                    newsPromises.push(NewsService.fetchGuardianNews({
                        section: guardianSecondarySection,
                        pageSize: Math.ceil(apiSourceFetchSize * 0.5),
                        orderBy: 'relevance',
                    }));
                }

                const nytimesSecondarySection = CATEGORY_MAPPING[secondaryCategory]?.nytimes;
                if (nytimesSecondarySection) {
                    newsPromises.push(NewsService.fetchNewYorkTimesTopStories({
                        section: nytimesSecondarySection,
                    }));
                }
            }
        } else {
            // If no preferred categories, fetch general/world news from Guardian and NYTimes
            newsPromises.push(NewsService.fetchGuardianNews({
                section: 'world',
                pageSize: apiSourceFetchSize,
                orderBy: 'newest',
            }));

            newsPromises.push(NewsService.fetchNewYorkTimesTopStories({section: 'world'}));
        }

        const newsResults = await Promise.allSettled(newsPromises);
        const allArticles = newsResults
            .filter(r => r.status === 'fulfilled' && r.value)
            .flatMap(r => (r as any).value);

        // Score and filter articles
        const scoredArticles: IRecommendedArticle[] = allArticles
            .filter(article => !(!article.url || readUrls.has(article.url)))
            .map(article => {
                let score = 0;
                const source: TSupportedSource | null = extractSourceFromUrl(article.url);

                // For Guardian and NYTimes, use domain as source identifier
                let effectiveSource = source;
                if (!source) {
                    const domain = new URL(article.url).hostname.replace('www.', '');
                    if (domain.includes('guardian')) {
                        effectiveSource = 'guardian' as TSupportedSource;
                    } else if (domain.includes('nytimes')) {
                        effectiveSource = 'nytimes' as TSupportedSource;
                    }
                }

                if (!effectiveSource) {
                    return null;
                }

                // Major boost for top performing sources (analytics-driven)
                if (topPerformingSources.includes(effectiveSource)) {
                    score += 5;
                }

                // Boost score for frequently read sources
                if (sourceFrequency[effectiveSource]) {
                    score += sourceFrequency[effectiveSource] * 2;
                }

                // Boost score for preferred sources
                if (preferences?.preferredSources?.includes(effectiveSource)) {
                    score += 3;
                }

                // Boost score for preferred languages
                const articleLanguage = determineArticleLanguage(article.url);
                if (articleLanguage && preferredLanguages.includes(articleLanguage)) {
                    score += 2;
                }

                // Boost score for bookmarked sources
                const bookmarkedSources: TSupportedSource[] = bookmarks
                    .map(b => extractSourceFromUrl(b.articleUrl))
                    .filter((s): s is TSupportedSource => s !== null);
                if (bookmarkedSources.includes(effectiveSource)) {
                    score += 2;
                }

                // Recency boost (newer articles get higher scores)
                const articleDate = new Date(article.publishedAt || article.readAt);
                const hoursOld = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);
                score += Math.max(0, 24 - hoursOld) / 24;

                return {
                    ...article,
                    recommendationScore: score,
                    recommendationReason: getRecommendationReason(effectiveSource, sourceFrequency, preferences, bookmarkedSources, articleLanguage, preferredLanguages, topPerformingSources),
                };
            })
            .filter((article): article is IRecommendedArticle => article !== null)
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

        // if (NODE_ENV === 'production') {
        RECOMMENDATION_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        // }
        return result;
    } catch (error: any) {
        console.error('ERROR: getRecommendations:', error);
        throw error;
    }
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

// Helper functions
const extractSourceFromUrl = (url: string): TSupportedSource | null => {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname;

    // Guardian
    if (domain.includes('theguardian.com') || domain.includes('guardian.co.uk')) {
        return 'guardian' as TSupportedSource;
    }

    // NYTimes
    if (domain.includes('nytimes.com')) {
        return 'nytimes' as TSupportedSource;
    }

    // bbc_news and bbc_tech
    if (domain === 'feeds.bbci.co.uk') {
        if (path.includes('/bengali')) return 'bbc_news_bengali';
        if (path.includes('/hindi')) return 'bbc_news_hindi';
        if (path.includes('/technology')) return 'bbc_tech';
        if (path.includes('/news/rss.xml') || path === '/news/rss.xml') return 'bbc_news';
        return 'bbc_news'; // Default fallback for general BBC news
    }

    // espn
    if (domain === 'espn.com' || domain === 'www.espn.com') {
        return 'espn';
    }

    // zeenews
    if (domain === 'zeenews.india.com') {
        if (path.includes('/bengali/')) return 'zeenews_bengali';
        if (path.includes('/hindi/')) return 'zeenews_hindi';
        return 'zeenews_india';
    }

    // times of india
    if (domain === 'timesofindia.indiatimes.com') {
        if (path.includes('rssfeedstopstories')) return 'timesofindia_top';
        if (path.includes('rssfeedmostrecent')) return 'timesofindia_recent';
        if (path.includes('-2128936835')) return 'timesofindia_india';
        if (path.includes('296589292')) return 'timesofindia_world';
        if (path.includes('4719148')) return 'timesofindia_sports';
        return 'timesofindia_top'; // Default fallback
    }

    // ndtv
    if (domain === 'feeds.feedburner.com') {
        if (path.includes('ndtvnews-top-stories')) return 'ndtv_top';
        if (path.includes('ndtvnews-latest')) return 'ndtv_latest';
        if (path.includes('ndtvnews-trending-news')) return 'ndtv_trending';
        if (path.includes('ndtvnews-india-news')) return 'ndtv_india';
        if (path.includes('ndtvnews-world-news')) return 'ndtv_world';
        if (path.includes('ndtvsports-latest')) return 'ndtv_sports';
        if (path.includes('ndtvsports-cricket')) return 'ndtv_cricket';
        if (path.includes('gadgets360-latest')) return 'ndtv_tech';
        if (path.includes('ndtvkhabar-latest')) return 'ndtv_hindi';
        return 'ndtv_top'; // Default fallback
    }

    // hindu
    if (domain === 'thehindu.com') {
        if (path.includes('/news/national/')) return 'the_hindu_india';
        if (path.includes('/news/international/')) return 'the_hindu_world';
        if (path.includes('/sport/cricket/')) return 'the_hindu_cricket';
        if (path.includes('/business/Economy/')) return 'the_hindu_economy';
        return 'the_hindu_india'; // Default fallback
    }

    // NYTimes RSS
    if (domain === 'rss.nytimes.com') {
        if (path.includes('/World.xml')) return 'nytWorld';
        if (path.includes('/Americas.xml')) return 'nytAmerica';
        if (path.includes('/US.xml')) return 'nytUS';
        if (path.includes('/AsiaPacific.xml')) return 'nytAsiaPacific';
        if (path.includes('/Business.xml')) return 'nytBusiness';
        if (path.includes('/Technology.xml')) return 'nytTechnology';
        if (path.includes('/PersonalTech.xml')) return 'nytPersonalTech';
        if (path.includes('/Sports.xml')) return 'nytSports';
        if (path.includes('/tmagazine.xml')) return 'nytTMagazine';
        return 'nytWorld'; // Default fallback
    }

// Economic Times B2B
    if (domain === 'b2b.economictimes.indiatimes.com') {
        if (path.includes('/topstories')) return 'b2bTopStories';
        if (path.includes('/recentstories')) return 'b2bRecentStories';
        if (path.includes('/government')) return 'b2bGovt';
        if (path.includes('/retail')) return 'b2bRetail';
        return 'b2bTopStories'; // Default fallback
    }

    // prothomalo
    if (domain === 'prothomalo.com') {
        return 'prothom_alo'; // Bengali version
    }
    if (domain === 'prod-qt-images.s3.amazonaws.com' && path.includes('prothomalo-english')) {
        return 'prothom_alo_english';
    }

    // abp_live (bengali)
    if (domain === 'bengali.abplive.com') {
        if (path.includes('/home/')) return 'abp_live_bengali_home';
        if (path.includes('/news/india/')) return 'abp_live_india';
        if (path.includes('/district/')) return 'abp_live_district';
        if (path.includes('/news/kolkata/')) return 'abp_live_kolkata';
        if (path.includes('/states/')) return 'abp_live_states';
        if (path.includes('/news/world/')) return 'abp_live_world';
        if (path.includes('/sports/')) return 'abp_live_sports';
        if (path.includes('/education/')) return 'abp_live_education';
        if (path.includes('/technology/')) return 'abp_live_technology';
        if (path.includes('/elections/')) return 'abp_live_election';
        if (path.includes('/trending/')) return 'abp_live_trending';
        return 'abp_live_bengali_home'; // Default fallback
    }

    // abp_live (hindi)
    if (domain === 'abplive.com') {
        if (path.includes('/home/')) return 'abp_live_hindi_home';
        if (path.includes('/news/world/')) return 'abp_live_world';
        if (path.includes('/states/')) return 'abp_live_states';
        if (path.includes('/sports/')) return 'abp_live_sports';
        if (path.includes('/education/')) return 'abp_live_education';
        if (path.includes('/education/jobs/')) return 'abp_live_jobs';
        if (path.includes('/elections/')) return 'abp_live_election';
        if (path.includes('/trending/')) return 'abp_live_trending';
        return 'abp_live_hindi_home'; // Default fallback
    }

    // news18
    if (domain === 'bengali.news18.com') {
        if (path.includes('/kolkata')) return 'bengali_news_18';
        if (path.includes('/politics')) return 'bengali_news_18_politics';
        if (path.includes('/cricket')) return 'bengali_news_18_cricket';
        if (path.includes('/elections')) return 'bengali_news_18_elections';
        return 'bengali_news_18'; // Default fallback
    }

    // amarujala
    if (domain === 'amarujala.com') {
        if (path.includes('breaking-news')) return 'amar_ujala_breaking';
        if (path.includes('west-bengal')) return 'amar_ujala_wb';
        if (path.includes('delhi')) return 'amar_ujala_delhi';
        return 'amar_ujala_breaking'; // Default fallback
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
                                 preferences: any, bookmarkedSources: string[], articleLanguage: string | null, preferredLanguages: string[], topPerformingSources: string[]): string => {
    if (topPerformingSources.includes(source)) {
        return `From top performing source: ${source}`;
    }
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

export {getContentRecommendation, clearRecommendationCache};
