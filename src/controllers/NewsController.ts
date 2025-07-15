import "colors";
import {Request, Response} from "express";
import {TopHeadlinesParams} from "../types/news";
import {ApiResponse} from "../utils/ApiResponse";
import {fetchTopHeadlines} from "../services/NewsService";

const getAllTopHeadlinesController = async (req: Request, res: Response) => {
    console.log('getAllTopHeadlinesController called');
    try {
        const {country, category, sources, q, pageSize, page}: Partial<TopHeadlinesParams> = req.query;

        let pageSizeNumber = 1, pageNumber = 1;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }
        if (page && !isNaN(page)) {
            pageNumber = Number(page);
        }
        const topHeadlines = await fetchTopHeadlines({country, category, sources, q, pageSize: pageSizeNumber, page: pageNumber});
        console.error('top headlines:'.green.bold, topHeadlines);

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

export {getAllTopHeadlinesController};
