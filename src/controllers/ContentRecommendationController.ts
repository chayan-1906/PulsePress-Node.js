import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {IGetContentRecommendationsParams} from "../types/content-recommendation";
import ContentRecommendationService from "../services/ContentRecommendationService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const getContentRecommendationController = async (req: Request, res: Response) => {
    console.info('Controller: getContentRecommendationController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {pageSize}: Partial<IGetContentRecommendationsParams> = req.query;

        let pageSizeNumber = 10;
        if (pageSize) {
            const parsed = Number(pageSize);
            if (isNaN(parsed) || parsed <= 0) {
                console.warn('Client Error: Invalid pageSize parameter'.yellow);
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'INVALID_PAGE_SIZE',
                    errorMsg: 'Page size must be a positive number',
                }));
                return;
            }
            pageSizeNumber = parsed;
        }

        const {recommendations, totalRecommendations, error} = await ContentRecommendationService.getContentRecommendation({email, pageSize: pageSizeNumber});

        if (error) {
            let errorMsg = 'Failed to get content recommendations';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            }

            console.warn('Client Error: Content recommendation failed'.yellow, {errorCode: error});
            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('Controller: Recommendations fetched successfully'.bgGreen.bold, {totalRecommendations});
        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Content recommendations fetched successfully',
            totalRecommendations,
            recommendations,
        }));
    } catch (error: any) {
        console.error('Controller Error: getContentRecommendationController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode || 'INTERNAL_SERVER_ERROR',
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {getContentRecommendationController};
