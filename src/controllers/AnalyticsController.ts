import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import {getSourceAnalytics, getTopPerformingSources} from "../services/AnalyticsService";
import {GetSourceAnalyticsParams, GetTopPerformingSourcesParams} from "../types/analytics";

const getSourceAnalyticsController = async (req: Request, res: Response) => {
    console.info('getSourceAnalyticsController called'.bgMagenta.white.italic);

    try {
        const {limit, sortBy, sortOrder}: GetSourceAnalyticsParams = req.query;

        let limitNumber;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }

        const {sourceAnalytics, totalSources, error} = await getSourceAnalytics({limit: limitNumber, sortBy, sortOrder});

        if (error) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_SOURCE_ANALYTICS_FAILED',
                errorMsg: 'Failed to get source analytics',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Source analytics fetched successfully 🎉',
            sourceAnalytics,
            totalSources,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getSourceAnalyticsController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const getTopPerformingSourcesController = async (req: Request, res: Response) => {
    console.info('getTopPerformingSourcesController called'.bgMagenta.white.italic);

    try {
        const {limit, minViews}: GetTopPerformingSourcesParams = req.query;

        let limitNumber, minViewsNumber;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }
        if (minViews && !isNaN(Number(minViews))) {
            minViewsNumber = Number(minViews);
        }

        const {topSources, totalSources, error} = await getTopPerformingSources({limit: limitNumber, minViews: minViewsNumber});

        if (error) {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_TOP_SOURCES_FAILED',
                errorMsg: 'Failed to get top performing sources',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Top performing sources fetched successfully 🎉',
            topSources,
            totalSources,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getTopPerformingSourcesController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {getSourceAnalyticsController, getTopPerformingSourcesController};
