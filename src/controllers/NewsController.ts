import "colors";
import {Request, Response} from "express";
import {isListEmpty} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {fetchRSSFeed, fetchTopHeadlines, scrapeMultipleArticles} from "../services/NewsService";
import {RSSFeedParams, ScrapeMultipleWebsitesParams, SUPPORTED_NEWS_LANGUAGES, TopHeadlinesParams} from "../types/news";

const getAllTopHeadlinesController = async (req: Request, res: Response) => {
    console.info('getAllTopHeadlinesController called'.bgMagenta.white.italic);
    try {
        const {country, category, sources, q, pageSize, page}: Partial<TopHeadlinesParams> = req.query;

        let pageSizeNumber, pageNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await fetchTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('top headlines:'.cyan.italic, topHeadlines);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top headlines have been found 🎉',
            topHeadlines,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getAllTopHeadlinesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getAllRSSFeedsController = async (req: Request, res: Response) => {
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
        const rssFeeds = await fetchRSSFeed({sources, languages, pageSize: pageSizeNumber, page: pageNumber});
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

export {getAllTopHeadlinesController, getAllRSSFeedsController, scrapeWebsiteController};
