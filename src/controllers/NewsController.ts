import "colors";
import {Request, Response} from "express";
import {isListEmpty} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {
    fetchAllRSSFeeds,
    fetchGuardianNews,
    fetchNEWSORGEverything,
    fetchNEWSORGTopHeadlines,
    fetchNYTimesNews,
    fetchNYTimesTopStories,
    scrapeMultipleArticles,
    smartFetchNews
} from "../services/NewsService";
import {
    GuardianSearchParams,
    NEWSORGEverythingParams,
    NEWSORGTopHeadlinesParams,
    NYTimesSearchParams,
    NYTimesTopStoriesParams,
    RSSFeedParams,
    ScrapeMultipleWebsitesParams,
    SUPPORTED_NEWS_LANGUAGES
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
        const topHeadlines = await fetchNEWSORGTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
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
        const everything = await fetchNEWSORGEverything({sources, from, to, sortBy, language, q, pageSize: pageSizeNumber, page: pageNumber});
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

        const guardianResults = await fetchGuardianNews({q, section, fromDate, toDate, orderBy, pageSize: pageSizeNumber, page: pageNumber});

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

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }

        const nytResults = await fetchNYTimesNews({q, section, sort, fromDate, toDate, pageSize: pageSizeNumber, page: pageNumber});

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

        const nytTopStories = await fetchNYTimesTopStories({section});

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
        const {sources, languages, pageSize, page}: Partial<RSSFeedParams> = req.query;

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
        const rssFeeds = await fetchAllRSSFeeds({sources, languages, pageSize: pageSizeNumber, page: pageNumber});
        console.timeEnd('RSS_FETCH_TIME'.bgMagenta.white.italic);
        console.log('rss feeds:'.green.bold, rssFeeds.length);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'RSS Feeds have been found 🎉',
            totalResults: rssFeeds.length,
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

// TODO: REMOVE
/**
 * Current smartFetchNews() Analysis
 * What it does: Implements a cascading fallback search across multiple APIs with intelligent article deduplication.
 * Flow:
 *
 * NewsAPI (40% of requested articles)
 * Guardian API (40% remaining slots)
 * NYTimes API (30% remaining slots)
 * RSS feeds (fill remaining)
 *
 * Example: Request 10 articles for "climate change"
 * 1. NewsAPI → 4 articles (40% of 10)
 * 2. Guardian → 2-3 new articles (dedupe by URL)
 * 3. NYTimes → 1-2 new articles (dedupe by URL)
 * 4. RSS → 1-3 articles to reach 10 total
 */
const smartFetchNewsController = async (req: Request, res: Response) => {
    console.info('smartFetchNewsController called'.bgMagenta.white.italic);
    try {
        // TODO: Create an interface
        const {q, category, sources, pageSize, page}: {
            q?: string;
            category?: string;
            sources?: string;
            pageSize?: number;
            page?: number;
        } = req.query;

        if (!q && !category && !sources) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'MISSING_SEARCH_PARAMS',
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

        console.time('SMART_FETCH_TIME'.bgMagenta.white.italic);
        const smartResults = await smartFetchNews({q, category, sources, pageSize: pageSizeNumber, page: pageNumber});
        console.timeEnd('SMART_FETCH_TIME'.bgMagenta.white.italic);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Smart news search completed 🎉',
            searchResults: smartResults,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of smartFetchNewsController:'.red.bold, error);
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

        const scrapedArticles = await scrapeMultipleArticles({urls});
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

export {
    fetchNEWSORGTopHeadlinesController,
    fetchNEWSORGEverythingController,
    fetchGuardianNewsController,
    fetchNYTimesNewsController,
    fetchNYTimesTopStoriesController,
    fetchAllRSSFeedsController,
    smartFetchNewsController,
    scrapeWebsiteController,
};
