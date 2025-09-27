import "colors";
import {Request, Response} from "express";
import {isListEmpty} from "../utils/list";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import NewsService from "../services/NewsService";
import {generateArticleId} from "../utils/generateArticleId";
import ArticleEnhancementService from "../services/ArticleEnhancementService";
import {COUNTRY_KEYWORDS, TOPIC_METADATA, TOPIC_QUERIES} from "../utils/constants";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IArticleDetailsEnhanceParams,
    IExploreTopicParams,
    IFetchMultisourceNewsEnhancementStatusParams,
    IGuardianSearchParams,
    IMultisourceFetchNewsParams,
    INewsApiOrgEverythingParams,
    INewsApiOrgTopHeadlinesParams,
    INewYorkTimesSearchParams,
    INewYorkTimesTopStoriesParams,
    IRssFeedParams,
    IScrapeMultipleWebsitesParams,
    SUPPORTED_NEWS_LANGUAGES,
    TCountry,
    VALID_NYTIMES_SECTIONS,
} from "../types/news";

const fetchNewsApiOrgTopHeadlinesController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewsApiOrgTopHeadlinesController started'.bgBlue.white.bold);

    try {
        const {country, category, sources, q, pageSize, page}: Partial<INewsApiOrgTopHeadlinesParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await NewsService.fetchNewsApiOrgTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('SUCCESS: Top headlines fetched'.bgGreen.bold, {count: topHeadlines?.totalResults || 0});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top headlines have been fetched 🎉',
            topHeadlines,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNewsApiOrgTopHeadlinesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while loading News API Org top headlines',
        }));
    }
}

const fetchNewsApiOrgEverythingController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewsApiOrgEverythingController started'.bgBlue.white.bold);

    try {
        const {sources, from, to, sortBy, language, q, pageSize, page}: Partial<INewsApiOrgEverythingParams> = req.query;

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
        const everything = await NewsService.fetchNewsApiOrgEverything({sources, from, to, sortBy, language, q, pageSize: pageSizeNumber, page: pageNumber});
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
            errorMsg: error.message || 'Something went wrong while loading News API Org news articles',
        }));
    }
}

const fetchGuardianNewsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchGuardianNewsController started'.bgBlue.white.bold);

    try {
        const {q, section, fromDate, toDate, orderBy, pageSize, page}: Partial<IGuardianSearchParams> = req.query;

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
            errorMsg: error.message || 'Something went wrong while loading Guardian news',
        }));
    }
}

const fetchNewYorkTimesNewsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewYorkTimesNewsController started'.bgBlue.white.bold);

    try {
        const {q, section, sort, fromDate, toDate, pageSize, page}: Partial<INewYorkTimesSearchParams> = req.query;
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

        const nytResults = await NewsService.fetchNewYorkTimesNews({q, section, sort, fromDate, toDate, pageSize: pageSizeNumber, page: pageNumber});

        if (nytResults.error) {
            let errorMsg = 'Failed to fetch New York Times news';
            let statusCode = 500;

            if (nytResults.error === generateInvalidCode('nytimes_section')) {
                errorMsg = 'Invalid New York Times section';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: nytResults.error,
                errorMsg,
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'NYTimes news articles have been found 🎉',
            searchResults: nytResults,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNewYorkTimesNewsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while loading New York Times news',
        }));
    }
}

const fetchNewYorkTimesTopStoriesController = async (req: Request, res: Response) => {
    console.info('Controller: fetchNewYorkTimesTopStoriesController started'.bgBlue.white.bold);

    try {
        const {section}: Partial<INewYorkTimesTopStoriesParams> = req.query;

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

        const nytTopStories = await NewsService.fetchNewYorkTimesTopStories({section});

        if (nytTopStories.error) {
            let errorMsg = 'Failed to fetch New York Times top stories';
            let statusCode = 500;

            if (nytTopStories.error === generateInvalidCode('nytimes_section')) {
                errorMsg = 'Invalid New York Times section';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: nytTopStories.error,
                errorMsg,
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'NYTimes top stories have been found 🎉',
            searchResults: nytTopStories,
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchNewYorkTimesTopStoriesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while loading NYTimes top stories',
        }));
    }
}

const fetchAllRssFeedsController = async (req: Request, res: Response) => {
    console.info('Controller: fetchAllRssFeedsController started'.bgBlue.white.bold);

    try {
        const {q, sources, languages, category, pageSize, page}: Partial<IRssFeedParams> = req.query;

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
        const rssFeeds = await NewsService.fetchAllRssFeeds({q, sources, languages, category, pageSize: pageSizeNumber, page: pageNumber});
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
        console.error('Controller Error: fetchAllRssFeedsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while loading RSS feeds',
        }));
    }
}

const scrapeWebsiteController = async (req: Request, res: Response) => {
    console.info('Controller: scrapeWebsiteController started'.bgBlue.white.bold);

    try {
        const {urls}: Partial<IScrapeMultipleWebsitesParams> = req.body;

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
            errorMsg: error.message || 'Something went wrong while scraping website',
        }));
    }
}

const exploreTopicController = async (req: Request, res: Response) => {
    console.info('Controller: exploreTopicController started'.bgBlue.white.bold);

    try {
        const {topic}: Partial<IExploreTopicParams> = req.params;
        const {country, pageSize, page}: Partial<IExploreTopicParams> = req.query;

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
            const key = countryStr.toLowerCase() as TCountry;
            countryTerms = COUNTRY_KEYWORDS[key];
        }

        if (countryTerms) {
            predefinedQuery = `${predefinedQuery} ${countryTerms}`;
        }

        const email = (req as IAuthRequest).email;

        console.time('Performance: TOPIC_EXPLORATION_TIME'.cyan);
        const topicResults = await NewsService.fetchMultiSourceNewsEnhanced({
            email,
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
        const email = (req as IAuthRequest).email;
        const {q, category, sources, pageSize, page}: Partial<IMultisourceFetchNewsParams> = req.query;

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
            errorMsg: error.message || 'Something went wrong while loading enhanced news articles',
        }));
    }
}

const fetchMultiSourceNewsEnhancementStatusController = async (req: Request, res: Response) => {
    console.info('Controller: fetchEnhancementStatusController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {articleIds}: Partial<IFetchMultisourceNewsEnhancementStatusParams> = req.query;

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
            let errorMsg = 'Failed to fetch status';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === generateMissingCode('content')) {
                errorMsg = 'Content is missing';
                statusCode = 400;
            } else if (error === 'AI_ENHANCEMENT_FAILED') {
                errorMsg = 'AI enhancement failed';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
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
            errorMsg: error.message || 'Something went wrong while checking AI enhancement status',
        }));
    }
}

const fetchArticleDetailsEnhancementController = async (req: Request, res: Response) => {
    console.info('Controller: fetchArticleDetailsEnhancementController started'.bgBlue.white.bold);

    try {
        const {url}: Partial<IArticleDetailsEnhanceParams> = req.body;

        if (!url) {
            console.warn('Client Error: Missing articleUrl parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('url'),
                errorMsg: 'URL is required',
            }));
            return;
        }

        const email = (req as IAuthRequest).email;
        console.log('Article details enhancement request'.cyan, {email, url});

        console.time('Performance: ARTICLE_DETAILS_ENHANCEMENT_TIME'.cyan);
        const {enhanced, progress, article, error} = await ArticleEnhancementService.fetchArticleDetailsEnhancement({email, url});
        console.timeEnd('Performance: ARTICLE_DETAILS_ENHANCEMENT_TIME'.cyan);

        if (error) {
            let errorMsg = 'Failed to fetch article details enhancement';
            let statusCode = 500;

            if (error === generateNotFoundCode('article')) {
                errorMsg = 'Article not found';
                statusCode = 404;
            } else if (error === generateMissingCode('articleId')) {
                errorMsg = 'ArticleId is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('articleUrl')) {
                errorMsg = 'ArticleUrl is missing';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        const message = enhanced
            ? `Article details enhancement completed! Progress: ${progress}% ✨`
            : `Article details retrieved with ${progress}% enhancements available 📖`;

        const articleId = generateArticleId({url});

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            processingStatus: article?.processingStatus || (enhanced ? 'completed' : 'pending'),
            progress,
            enhanced,
            article: {
                articleId,
                url,
                tags: article?.tags,
                sentiment: article?.sentiment,
                keyPoints: article?.keyPoints,
                complexityMeter: article?.complexityMeter,
                locations: article?.locations,
                questions: article?.questions,
                summaries: article?.summaries,
                socialMediaCaptions: article?.socialMediaCaptions,
                newsInsights: article?.newsInsights,
            },
        }));
    } catch (error: any) {
        console.error('Controller Error: fetchArticleDetailsEnhancementController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while fetching article details enhancement',
        }));
    }
}

export {
    fetchNewsApiOrgTopHeadlinesController,
    fetchNewsApiOrgEverythingController,
    fetchGuardianNewsController,
    fetchNewYorkTimesNewsController,
    fetchNewYorkTimesTopStoriesController,
    fetchAllRssFeedsController,
    fetchMultiSourceNewsEnhancedController,
    fetchMultiSourceNewsEnhancementStatusController,
    fetchArticleDetailsEnhancementController,
    scrapeWebsiteController,
    exploreTopicController,
};
