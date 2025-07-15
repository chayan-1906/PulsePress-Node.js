import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import {RSSFeedParams, TopHeadlinesParams} from "../types/news";
import {fetchRSSFeed, fetchTopHeadlines} from "../services/NewsService";

const getAllTopHeadlinesController = async (req: Request, res: Response) => {
    console.log('getAllTopHeadlinesController called');
    try {
        const {country, category, sources, q, pageSize, page}: Partial<TopHeadlinesParams> = req.query;

        let pageSizeNumber = 10, pageNumber = 1;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await fetchTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.log('top headlines:'.green.bold, topHeadlines);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top headlines found 🎉',
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
        const {sources, pageSize, page}: Partial<RSSFeedParams> = req.query;

        let pageSizeNumber = 10, pageNumber = 1;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const rssFeeds = await fetchRSSFeed({sources, pageSize: pageSizeNumber, page: pageNumber});
        console.log('rss feeds:'.green.bold, rssFeeds);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'RSS Feeds found 🎉',
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
