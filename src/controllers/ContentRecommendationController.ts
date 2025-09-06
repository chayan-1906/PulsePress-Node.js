import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {IGetContentRecommendationsParams} from "../types/content-recommendation";
import {getContentRecommendation} from "../services/ContentRecommendationService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const getContentRecommendationController = async (req: Request, res: Response) => {
    console.info('getContentRecommendationController called'.bgMagenta.white.italic);

    try {
        const email = (req as IAuthRequest).email;
        const {pageSize}: Partial<IGetContentRecommendationsParams> = req.query;

        let pageSizeNumber;
        if (pageSize && !isNaN(pageSize)) {
            pageSizeNumber = Number(pageSize);
        }

        const {recommendations, totalRecommendations, error} = await getContentRecommendation({email, pageSize: pageSizeNumber});

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

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('recommended content:'.cyan.italic, {recommendations, totalRecommendations});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Recommended content has been fetched 🎉',
            totalRecommendations,
            recommendations,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getContentRecommendationController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {getContentRecommendationController};
