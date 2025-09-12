import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import AnalyticsService from "../services/AnalyticsService";
import {IGetSourceAnalyticsParams, IGetTopPerformingSourcesParams} from "../types/analytics";

const getSourceAnalyticsController = async (req: Request, res: Response) => {
    console.info('Controller: getSourceAnalyticsController started'.bgBlue.white.bold);

    try {
        const {limit, sortBy, sortOrder}: IGetSourceAnalyticsParams = req.query;

        let limitNumber;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }

        const {sourceAnalytics, totalSources, error} = await AnalyticsService.getSourceAnalytics({limit: limitNumber, sortBy, sortOrder});

        if (error) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_SOURCE_ANALYTICS_FAILED',
                errorMsg: 'Failed to get source analytics',
            }));
            return;
        }

        console.log('SUCCESS: Source analytics fetched'.bgGreen.bold, {totalSources});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Source analytics has been fetched successfully 🎉',
            sourceAnalytics,
            totalSources,
        }));
    } catch (error: any) {
        console.error('Controller Error: getSourceAnalyticsController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during source analytics process',
        }));
    }
}

const getTopPerformingSourcesController = async (req: Request, res: Response) => {
    console.info('Controller: getTopPerformingSourcesController started'.bgBlue.white.bold);

    try {
        const {limit, minViews}: IGetTopPerformingSourcesParams = req.query;

        let limitNumber, minViewsNumber;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }
        if (minViews && !isNaN(Number(minViews))) {
            minViewsNumber = Number(minViews);
        }

        const {topSources, totalSources, error} = await AnalyticsService.getTopPerformingSources({limit: limitNumber, minViews: minViewsNumber});

        if (error) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_TOP_SOURCES_FAILED',
                errorMsg: 'Failed to get top performing sources',
            }));
            return;
        }

        console.log('SUCCESS: Top performing sources fetched'.bgGreen.bold, {totalSources});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top performing sources have been fetched successfully 🎉',
            topSources,
            totalSources,
        }));
    } catch (error: any) {
        console.error('Controller Error: getTopPerformingSourcesController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during top performer retrieval',
        }));
    }
}

export {getSourceAnalyticsController, getTopPerformingSourcesController};
