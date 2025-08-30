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
    FetchArticleDetailsEnhancementStatusParams,
    FetchMultisourceNewsEnhancementStatusParams,
    FetchMultisourceNewsParams,
    GuardianSearchParams,
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

const fetchNEWSORGTopHeadlinesController = async (req: Request, res: Response) => {
    console.info('fetchNEWSORGTopHeadlinesController called'.bgMagenta.white.italic);
    try {
        const {country, category, sources, q, pageSize, page}: Partial<NEWSORGTopHeadlinesParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await NewsService.fetchNEWSORGTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('top headlines:'.cyan.italic, topHeadlines);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top headlines have been found 🎉',
            topHeadlines,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchNEWSORGTopHeadlinesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchNEWSORGEverythingController = async (req: Request, res: Response) => {
    console.info('fetchEverythingController called'.bgMagenta.white.italic);
    try {
        const {sources, from, to, sortBy, language, q, pageSize, page}: Partial<NEWSORGEverythingParams> = req.query;

        if (!sources && !q) {
            console.error('sources and q both are missing'.red.italic);
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
        const everything = await NewsService.fetchNEWSORGEverything({sources, from, to, sortBy, language, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('everything:'.cyan.italic, everything);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Search results have been found 🎉',
            searchResults: everything,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchEverythingController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchGuardianNewsController = async (req: Request, res: Response) => {
    console.info('fetchGuardianNewsController called'.bgMagenta.white.italic);
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
            message: 'Guardian news articles found 🎉',
            searchResults: guardianResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchGuardianNewsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchNYTimesNewsController = async (req: Request, res: Response) => {
    console.info('fetchNYTimesNewsController called'.bgMagenta.white.italic);
    try {
        const {q, section, sort, fromDate, toDate, pageSize, page}: Partial<NYTimesSearchParams> = req.query;
        console.log('q:'.bgMagenta.white.italic, q);

        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.error('Invalid NYTimes section:'.yellow.italic, section);
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
            message: 'NYTimes news articles found 🎉',
            searchResults: nytResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchNYTimesNewsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchNYTimesTopStoriesController = async (req: Request, res: Response) => {
    console.info('fetchNYTimesTopStoriesController called'.bgMagenta.white.italic);
    try {
        const {section}: Partial<NYTimesTopStoriesParams> = req.query;

        if (section && !VALID_NYTIMES_SECTIONS.includes(section)) {
            console.error('Invalid NYTimes section:'.yellow.italic, section);
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
            message: 'NYTimes top stories found 🎉',
            searchResults: nytTopStories,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchNYTimesTopStoriesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchAllRSSFeedsController = async (req: Request, res: Response) => {
    console.info('getAllRSSFeedsController called'.bgMagenta.white.italic);
    try {
        const {q, sources, languages, pageSize, page}: Partial<RSSFeedParams> = req.query;

        const sourceList = sources ? sources.split(',').map((source: string) => source.trim().toLowerCase()).filter(Boolean) : [];
        if (!isListEmpty(sourceList) && sourceList.every(lang => !SUPPORTED_NEWS_LANGUAGES.includes(lang))) {
            console.error('Sources not supported:'.yellow.italic, sources);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'SOURCES_NOT_SUPPORTED',
                errorMsg: `${sourceList.join(', ')} are not supported`,
            }));
            return;
        }

        const languageList = languages ? languages.split(',').map((lang: string) => lang.trim().toLowerCase()).filter(Boolean) : [];
        if (!isListEmpty(languageList) && languageList.every(lang => !SUPPORTED_NEWS_LANGUAGES.includes(lang))) {
            console.error('Languages not supported:'.yellow.italic, languageList);
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

        console.time('RSS_FETCH_TIME'.bgMagenta.white.italic);
        const rssFeeds = await NewsService.fetchAllRSSFeeds({q, sources, languages, pageSize: pageSizeNumber, page: pageNumber});
        console.timeEnd('RSS_FETCH_TIME'.bgMagenta.white.italic);
        console.log('rss feeds:'.green.bold, rssFeeds.length);

        const message = q
            ? `RSS search completed for "${q}" 🔍`
            : 'RSS Feeds have been found 🎉';

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            totalResults: rssFeeds.length,
            query: q || null,
            rssFeeds,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getAllRSSFeedsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchMultiSourceNewsController = async (req: Request, res: Response) => {
    console.info('fetchMultiSourceNewsController called'.bgMagenta.white.italic);
    try {
        const email = (req as AuthRequest).email;
        const {q, category, sources, pageSize, page}: Partial<FetchMultisourceNewsParams> = req.query;

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

        console.time('MULTISOURCE_FETCH_TIME'.bgMagenta.white.italic);
        const multisourceResults = await NewsService.fetchMultiSourceNews({
            email,
            q,
            category,
            sources,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('MULTISOURCE_FETCH_TIME'.bgMagenta.white.italic);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Multisource news search completed 🎉',
            searchResults: multisourceResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchMultiSourceNewsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const scrapeWebsiteController = async (req: Request, res: Response) => {
    console.info('scrapeWebsiteController called'.bgMagenta.white.italic);
    try {
        const {urls}: Partial<ScrapeMultipleWebsitesParams> = req.body;

        if (isListEmpty(urls)) {
            console.error('URLs is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('urls'),
                errorMsg: 'URLs is either missing or empty',
            }));
            return;
        }

        const scrapedArticles = await NewsService.scrapeMultipleArticles({urls});
        console.log('scraped contents:'.cyan.italic, scrapedArticles);

        const total = urls.length;
        const successCount = scrapedArticles.filter(scrapedArticle => scrapedArticle.status === 200).length;
        const failureCount = total - successCount;

        res.status(200).send(new ApiResponse({
            success: true,
            message: `Scraped ${successCount} of ${total} website${total > 1 ? 's' : ''} successfully 🎉`,
            totalResults: total,
            successful: successCount,
            failed: failureCount,
            contents: scrapedArticles,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of scrapeWebsiteController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const exploreTopicController = async (req: Request, res: Response) => {
    console.info('exploreTopicController called'.bgMagenta.white.italic);
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

        console.time('TOPIC_EXPLORATION_TIME'.bgMagenta.white.italic);
        const topicResults = await NewsService.fetchMultiSourceNews({
            q: predefinedQuery,
            category: topic,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('TOPIC_EXPLORATION_TIME'.bgMagenta.white.italic);

        res.status(200).send(new ApiResponse({
            success: true,
            message: `${TOPIC_METADATA[topic].name} news found 🎉`,
            topic: TOPIC_METADATA[topic],
            searchResults: topicResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of exploreTopicController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchMultiSourceNewsEnhancedController = async (req: Request, res: Response) => {
    console.info('fetchMultiSourceNewsEnhancedController called'.bgMagenta.white.italic);
    try {
        const email = (req as AuthRequest).email;
        const {q, category, sources, pageSize, page}: Partial<FetchMultisourceNewsParams> = req.query;

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

        console.time('ENHANCED_MULTISOURCE_FETCH_TIME'.bgGreen.white.italic);
        const enhancedResults = await NewsService.fetchMultiSourceNewsEnhanced({
            email,
            q,
            category,
            sources,
            pageSize: pageSizeNumber,
            page: pageNumber,
        });
        console.timeEnd('ENHANCED_MULTISOURCE_FETCH_TIME'.bgGreen.white.italic);

        res.status(200).send(new ApiResponse({
            success: true,
            message: `Enhanced multisource news completed! ${enhancedResults.metadata.enhancedCount}/${enhancedResults.metadata.totalArticles} articles have AI insights ✨`,
            searchResults: enhancedResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchMultiSourceNewsEnhancedController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchMultiSourceNewsEnhancementStatusController = async (req: Request, res: Response) => {
    console.info('fetchEnhancementStatusController called'.bgMagenta.white.italic);
    try {
        const email = (req as AuthRequest).email;
        const {articleIds}: Partial<FetchMultisourceNewsEnhancementStatusParams> = req.query;

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

        console.time('ENHANCEMENT_STATUS_CHECK_TIME'.bgGreen.white.italic);
        const statusResults = await ArticleEnhancementService.getEnhancementStatusByIds({email, articleIds: articleIdArray});
        const {status, progress, articles, error} = statusResults;
        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.error('User not found'.yellow.italic);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }

            if (error === generateMissingCode('email')) {
                console.error('Email is missing'.yellow.italic);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: generateMissingCode('email'),
                    errorMsg: 'Email is missing',
                }));
                return;
            }

            console.error('error in getEnhancementStatusByIds:'.yellow.italic, error);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg: 'Failed to fetch status',
            }));
            return;
        }
        console.timeEnd('ENHANCEMENT_STATUS_CHECK_TIME'.bgGreen.white.italic);

        const message = status === 'complete'
            ? `All enhancements completed! ${articles?.length}/${articleIdArray.length} articles enhanced ✨`
            : `Enhancement in progress: ${progress}% complete (${articles?.length}/${articleIdArray.length} articles)`;

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            statusResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchEnhancementStatusController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const fetchArticleDetailsEnhancedController = async (req: Request, res: Response) => {
    console.info('fetchArticleDetailsEnhancedController called'.bgMagenta.white.italic);
    try {
        const email = (req as AuthRequest).email;
        const {url} = req.body;

        if (!url || !url.trim()) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('url'),
                errorMsg: 'URL is required for article enhancement',
            }));
            return;
        }

        console.time('ARTICLE_DETAILS_ENHANCEMENT_TIME'.bgGreen.white.italic);
        const {articleId, article, status, error} = await ArticleEnhancementService.enhanceArticleForDetails({email, url});
        console.timeEnd('ARTICLE_DETAILS_ENHANCEMENT_TIME'.bgGreen.white.italic);

        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.error('User not found'.yellow.italic);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }

            if (error === generateMissingCode('email')) {
                console.error('Email is missing'.yellow.italic);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: generateMissingCode('email'),
                    errorMsg: 'Email is missing',
                }));
                return;
            }

            if (error === generateMissingCode('url')) {
                console.error('URL is missing'.yellow.italic);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: generateMissingCode('url'),
                    errorMsg: 'URL is required for article enhancement',
                }));
                return;
            }

            if (error === 'SCRAPING_FAILED') {
                console.error('Article scraping failed'.yellow.italic);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'SCRAPING_FAILED',
                    errorMsg: 'Failed to scrape article content from the provided URL',
                }));
                return;
            }

            console.error('Enhancement failed:'.yellow.italic, error);
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'ENHANCEMENT_FAILED',
                errorMsg: 'Failed to enhance article',
            }));
            return;
        }

        const message = status === 'complete'
            ? 'Article enhancement completed! All AI insights are ready ✨'
            : 'Article enhancement started! Processing AI insights in background 🚀';

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            article,
            status,
            articleId: article?.articleId || articleId,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchArticleDetailsEnhancedController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during article enhancement',
        }));
    }
}

const fetchArticleDetailsEnhancementStatusController = async (req: Request, res: Response) => {
    console.info('fetchArticleDetailsEnhancementStatusController called'.bgMagenta.white.italic);
    try {
        const email = (req as AuthRequest).email;
        const {articleId}: Partial<FetchArticleDetailsEnhancementStatusParams> = req.query;

        if (!articleId) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('articleId'),
                errorMsg: 'ArticleId parameter is required',
            }));
            return;
        }

        console.time('ARTICLE_DETAILS_ENHANCEMENT_STATUS_CHECK_TIME'.bgGreen.white.italic);
        const statusResult = await ArticleEnhancementService.getEnhancementStatusByIds({
            email,
            articleIds: [articleId],
        });
        const {status, progress, articles, error} = statusResult;
        console.timeEnd('ARTICLE_DETAILS_ENHANCEMENT_STATUS_CHECK_TIME'.bgGreen.white.italic);

        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.error('User not found'.yellow.italic);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }

            if (error === generateMissingCode('email')) {
                console.error('Email is missing'.yellow.italic);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: generateMissingCode('email'),
                    errorMsg: 'Email is missing',
                }));
                return;
            }

            console.error('error in getEnhancementStatusByIds:'.yellow.italic, error);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg: 'Failed to fetch article enhancement status',
            }));
            return;
        }

        const article = articles && articles.length > 0 ? articles[0] : null;

        const message = status === 'complete' && article
            ? 'Article enhancement completed! All AI insights are ready ✨'
            : `Article enhancement in progress: ${progress}% complete`;

        res.status(200).send(new ApiResponse({
            success: true,
            message,
            articleId,
            article,
            status,
            progress,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchArticleDetailsEnhancementStatusController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while checking enhancement status',
        }));
    }
}

export {
    fetchNEWSORGTopHeadlinesController,
    fetchNEWSORGEverythingController,
    fetchGuardianNewsController,
    fetchNYTimesNewsController,
    fetchNYTimesTopStoriesController,
    fetchAllRSSFeedsController,
    fetchMultiSourceNewsController,
    fetchMultiSourceNewsEnhancedController,
    fetchMultiSourceNewsEnhancementStatusController,
    scrapeWebsiteController,
    exploreTopicController,
    fetchArticleDetailsEnhancedController,
    fetchArticleDetailsEnhancementStatusController,
};
