import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import {fetchRSSFeed, fetchTopHeadlines} from "../services/NewsService";
import {RSSFeedParams, SUPPORTED_NEWS_LANGUAGES, TopHeadlinesParams} from "../types/news";

const getAllTopHeadlinesController = async (req: Request, res: Response) => {
    console.log('getAllTopHeadlinesController called');
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
    console.log('getAllRSSFeedsController called');
    try {
        const {sources, language, pageSize, page}: Partial<RSSFeedParams> = req.query;

        if (language && !SUPPORTED_NEWS_LANGUAGES.includes(language)) {
            console.error('Language not supported:'.yellow.italic, language);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'LANGUAGE_NOT_SUPPORTED',
                errorMsg: `${language} is not supported`,
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
        const rssFeeds = await fetchRSSFeed({sources, language, pageSize: pageSizeNumber, page: pageNumber});
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

export {getAllTopHeadlinesController, getAllRSSFeedsController};
