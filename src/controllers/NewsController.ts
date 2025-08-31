import "colors";
import {Request, Response} from "express";
import {isListEmpty} from "../utils/list";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import NewsService from "../services/NewsService";
import ArticleEnhancementService from "../services/ArticleEnhancementService";
import {COUNTRY_KEYWORDS, TOPIC_METADATA, TOPIC_QUERIES} from "../utils/constants";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    Country,
    ExploreTopicParams,
    GuardianSearchParams,
    MultisourceFetchNewsParams,
    NEWSORGEverythingParams,
    NEWSORGTopHeadlinesParams,
    NYTimesSearchParams,
    NYTimesTopStoriesParams,
    RSSFeedParams,
    ScrapeMultipleWebsitesParams,
    SUPPORTED_NEWS_LANGUAGES,
    Topic,
    VALID_NYTIMES_SECTIONS,
} from "../types/news";

const fetchNewsAPIOrgTopHeadlinesController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewsAPIOrgTopHeadlinesController started'.bgBlue.white.bold);

    try {
        const {country, category, sources, q, pageSize, page}: Partial<NEWSORGTopHeadlinesParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await NewsService.fetchNewsAPIOrgTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('SUCCESS: Top headlines fetched'.bgGreen.bold, {count: topHeadlines?.totalResults || 0});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top headlines have been fetched 🎉',
            topHeadlines,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNewsAPIOrgTopHeadlinesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of top headlines from News API Org',
        }));
    }
}

const fetchNewsAPIOrgEverythingController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewsAPIOrgEverythingController started'.bgBlue.white.bold);

    try {
        const {sources, from, to, sortBy, language, q, pageSize, page}: Partial<NEWSORGEverythingParams> = req.query;

        if (!sources && !q) {
            console.warn('Client Error: Missing required search parameters'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'MISSING_SEARCH_PARAMS',
                errorMsg: 'Either sources or q (query) parameter is required',
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const everything = await NewsService.fetchNewsAPIOrgEverything({sources, from, to, sortBy, language, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('SUCCESS: Everything search completed'.bgGreen.bold, {count: everything?.totalResults || 0});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Search results have been found 🎉',
            searchResults: everything,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNewsAPIOrgEverythingController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of everything from News API Org',
        }));
    }
}

const fetchGuardianNewsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchGuardianNewsController started'.bgBlue.white.bold);

    try {
        const {q, section, fromDate, toDate, orderBy, pageSize, page}: Partial<GuardianSearchParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const guardianResults = await NewsService.fetchGuardianNews({q, section, fromDate, toDate, orderBy, pageSize: pageSizeNumber, page: pageNumber});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Guardian news articles have been found 🎉',
            searchResults: guardianResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchGuardianNewsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of Guardian news',
        }));
    }
}

const fetchNYTimesNewsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNYTimesNewsController started'.bgBlue.white.bold);

    try {
        const {q, section, sort, fromDate, toDate, pageSize, page}: Partial<NYTimesSearchParams> = req.query;
        console.debug('Debug: NYTimes query parameter'.gray, {q});

        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.warn('Client Error: Invalid NYTimes section'.yellow, {section});
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('nytimes_section'),
                errorMsg: 'Section is invalid',
                validSections: VALID_NYTIMES_SECTIONS,
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const nytResults = await NewsService.fetchNYTimesNews({q, section, sort, fromDate, toDate, pageSize: pageSizeNumber, page: pageNumber});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'NYTimes news articles have been found 🎉',
            searchResults: nytResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNYTimesNewsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of NYTimes news',
        }));
    }
}

const fetchNYTimesTopStoriesController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNYTimesTopStoriesController started'.bgBlue.white.bold);

    try {
        const {section}: Partial<NYTimesTopStoriesParams> = req.query;

        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.warn('Client Error: Invalid NYTimes section'.yellow, {section});
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('nytimes_section'),
                errorMsg: 'Section is invalid',
                validSections: VALID_NYTIMES_SECTIONS,
            }));
            return;
        }

        const nytTopStories = await NewsService.fetchNYTimesTopStories({section});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'NYTimes top stories have been found 🎉',
            searchResults: nytTopStories,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNYTimesTopStoriesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of top stories from NYTimes',
        }));
    }
}

const fetchAllRSSFeedsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchAllRSSFeedsController started'.bgBlue.white.bold);

    try {
        const {q, sources, languages, pageSize, page}: Partial<RSSFeedParams> = req.query;

        const sourceList = sources ? sources.split(',').map((source: string) => source.trim().toLowerCase()).filter(Boolean) : [];
        if (!isListEmpty(sourceList) && sourceList.every(lang => !SUPPORTED_NEWS_LANGUAGES.includes(lang))) {
            console.warn('Client Error: Unsupported news sources'.yellow, {sources});
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'SOURCES_NOT_SUPPORTED',
                errorMsg: `${sourceList.join(', ')} are not supported`,
            }));
            return;
        }

        const languageList = languages ? languages.split(',').map((lang: string) => lang.trim().toLowerCase()).filter(Boolean) : [];
        if (!isListEmpty(languageList) && languageList.every(lang => !SUPPORTED_NEWS_LANGUAGES.includes(lang))) {
            console.warn('Client Error: Unsupported news languages'.yellow, {languages: languageList});
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'LANGUAGES_NOT_SUPPORTED',
                errorMsg: `${languageList.join(', ')} are not supported`,
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        console.time('Performance: RSS_FETCH_TIME'.cyan);
        const rssFeeds = await NewsService.fetchAllRSSFeeds({q, sources, languages, pageSize: pageSizeNumber, page: pageNumber});
        console.timeEnd('Performance: RSS_FETCH_TIME'.cyan);
        console.log('SUCCESS: RSS feeds fetched'.bgGreen.bold, {count: rssFeeds.length});

        const message = q
            ? `RSS search has been completed for "${q}" 🔍`
            : 'RSS Feeds have been found 🎉';

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            totalResults: rssFeeds.length,
            query: q || null,
            rssFeeds,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchAllRSSFeedsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of RSS Feeds',
        }));
    }
}

const fetchMultiSourceNewsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchMultiSourceNewsController started'.bgBlue.white.bold);

    try {
        const email = (req as AuthRequest).email;
        const {q, category, sources, pageSize, page}: Partial<MultisourceFetchNewsParams> = req.query;

        if (!q && !category && !sources) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('q_category_sources'),
                errorMsg: 'At least one of q (query), category, or sources parameter is required',
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        console.time('Performance: MULTISOURCE_FETCH_TIME'.cyan);
        const multisourceResults = await NewsService.fetchMultiSourceNews({
            email,
            q,
            category,
            sources,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('Performance: MULTISOURCE_FETCH_TIME'.cyan);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Multisource news search has been completed 🎉',
            searchResults: multisourceResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchMultiSourceNewsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of multisource news',
        }));
    }
}

const scrapeWebsiteController = async (req: Request, res: Response) => {
    console.info('Controller: scrapeWebsiteController started'.bgBlue.white.bold);

    try {
        const {urls}: Partial<ScrapeMultipleWebsitesParams> = req.body;

        if (isListEmpty(urls)) {
            console.warn('Client Error: Missing URLs parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('urls'),
                errorMsg: 'URLs is either missing or empty',
            }));
            return;
        }

        const scrapedArticles = await NewsService.scrapeMultipleArticles({urls});

        const total = urls.length;
        const successCount = scrapedArticles.filter(scrapedArticle => scrapedArticle.status === 200).length;
        const failureCount = total - successCount;
        console.log('SUCCESS: Website scraping completed'.bgGreen.bold, {successCount, total});

        res.status(200).send(new ApiResponse({
            success: true,
            message: `Scraped ${successCount} of ${total} website${total > 1 ? 's' : ''} successfully 🎉`,
            totalResults: total,
            successful: successCount,
            failed: failureCount,
            contents: scrapedArticles,
        }));
    } catch (error: any) {
        console.error('Controller Error: scrapeWebsiteController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during website scraping',
        }));
    }
}

const exploreTopicController = async (req: Request, res: Response) => {
    console.info('Controller: exploreTopicController started'.bgBlue.white.bold);

    try {
        const {topic}: { topic?: Topic } = req.params;
        const {country, pageSize, page}: Partial<ExploreTopicParams> = req.query;

        if (!topic || !TOPIC_QUERIES[topic]) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('topic'),
                errorMsg: `Topic must be one of: ${Object.keys(TOPIC_QUERIES).join(', ')}`,
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        let predefinedQuery: string = TOPIC_QUERIES[topic] ?? '';

        let countryTerms: string | undefined;
        const countryStr = Array.isArray(country) ? country[0] : country;
        if (countryStr) {
            const key = countryStr.toLowerCase() as Country;
            countryTerms = COUNTRY_KEYWORDS[key];
        }

        if (countryTerms) {
            predefinedQuery = `${predefinedQuery} ${countryTerms}`;
        }

        console.time('Performance: TOPIC_EXPLORATION_TIME'.cyan);
        const topicResults = await NewsService.fetchMultiSourceNews({
            q: predefinedQuery,
            category: topic,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('Performance: TOPIC_EXPLORATION_TIME'.cyan);

        res.status(200).send(new ApiResponse({
            success: true,
            message: `${TOPIC_METADATA[topic].name} news have been found 🎉`,
            topic: TOPIC_METADATA[topic],
            searchResults: topicResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: exploreTopicController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during topic exploration',
        }));
    }
}

const fetchMultiSourceNewsEnhancedController = async (req: Request, res: Response) => {
    console.info('Controller: fetchMultiSourceNewsEnhancedController started'.bgBlue.white.bold);

    try {
        const email = (req as AuthRequest).email;
        const {q, category, sources, pageSize, page}: Partial<MultisourceFetchNewsParams> = req.query;

        if (!q && !category && !sources) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('q_category_sources'),
                errorMsg: 'At least one of q (query), category, or sources parameter is required',
            }));
            return;
        }

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        console.time('Performance: ENHANCED_MULTISOURCE_FETCH_TIME'.cyan);
        const enhancedResults = await NewsService.fetchMultiSourceNewsEnhanced({
            email,
            q,
            category,
            sources,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('Performance: ENHANCED_MULTISOURCE_FETCH_TIME'.cyan);

        res.status(200).send(new ApiResponse({
            success: true,
            message: `Enhanced multisource news have been completed! ${enhancedResults.metadata.enhancedCount}/${enhancedResults.metadata.totalArticles} articles have AI insights ✨`,
            searchResults: enhancedResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchMultiSourceNewsEnhancedController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of multisource news with AI Enhancements',
        }));
    }
}

const fetchEnhancementStatusController = async (req: Request, res: Response) => {
    console.info('Controller: fetchEnhancementStatusController started'.bgBlue.white.bold);

    try {
        const email = (req as AuthRequest).email;
        const {articleIds}: { articleIds?: string } = req.query;

        if (!articleIds) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleIds'),
                errorMsg: 'ArticleIds parameter is required (comma-separated list)',
            }));
            return;
        }

        const articleIdArray = articleIds.split(',').map(id => id.trim()).filter(id => id.length > 0);

        if (articleIdArray.length === 0) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('articleIds'),
                errorMsg: 'At least one valid articleId is required',
            }));
            return;
        }

        console.time('Performance: ENHANCEMENT_STATUS_CHECK_TIME'.cyan);
        const statusResults = await ArticleEnhancementService.getEnhancementStatusByIds({email, articleIds: articleIdArray});
        const {status, progress, articles, error} = statusResults;
        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.warn('Client Error: User not found'.yellow);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }

            console.warn('Client Error: Enhancement status fetch failed'.yellow, {error});
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg: 'Failed to fetch status',
            }));
            return;
        }
        console.timeEnd('Performance: ENHANCEMENT_STATUS_CHECK_TIME'.cyan);

        const message = status === 'complete'
            ? `All enhancements have been completed! ${articles?.length}/${articleIdArray.length} articles enhanced ✨`
            : `Enhancement is in progress: ${progress}% complete (${articles?.length}/${articleIdArray.length} articles)`;

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            statusResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchEnhancementStatusController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during fetch of multisource news AI enhancement status',
        }));
    }
}

export {
    fetchNewsAPIOrgTopHeadlinesController,
    fetchNewsAPIOrgEverythingController,
    fetchGuardianNewsController,
    fetchNYTimesNewsController,
    fetchNYTimesTopStoriesController,
    fetchAllRSSFeedsController,
    fetchMultiSourceNewsController,
    fetchMultiSourceNewsEnhancedController,
    fetchEnhancementStatusController,
    scrapeWebsiteController,
    exploreTopicController,
};
