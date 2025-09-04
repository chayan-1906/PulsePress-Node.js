import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {IGetUserStrikeHistoryParams} from "../types/ai";
import UserStrikeService from "../services/UserStrikeService";
import {generateNotFoundCode} from "../utils/generateErrorCodes";

const getUserStrikeStatusController = async (req: Request, res: Response) => {
    console.info('Controller: getUserStrikeStatusController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {strikeStatus, error} = await UserStrikeService.getUserStrikeStatus({email});

        if (error) {
            let errorMsg = 'Failed to get user strike status';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'STRIKE_DATA_UNAVAILABLE') {
                errorMsg = 'Strike data unavailable';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: User strike status fetched'.bgGreen.bold, {strikeStatus});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Strike status has been fetched 🎉',
            strikeStatus,
        }));
    } catch (error: any) {
        console.error('Controller Error: getUserStrikeStatusController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during user strike status retrieval!',
        }));
    }
}

const getUserStrikeHistoryController = async (req: Request, res: Response) => {
    console.info('Controller: getUserStrikeHistoryController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {limit}: Partial<IGetUserStrikeHistoryParams> = req.query;

        let limitNumber = 10;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }

        const {strikeHistory, totalStrikes, error} = await UserStrikeService.getUserStrikeHistory({email, limit: limitNumber});

        if (error) {
            let errorMsg = 'Failed to get user strike history';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'STRIKE_DATA_UNAVAILABLE') {
                errorMsg = 'Strike data unavailable';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: User strike history fetched'.bgGreen.bold, {totalStrikes});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Strike history has been fetched 🎉',
            strikeHistory,
            totalStrikes,
        }));
    } catch (error: any) {
        console.error('Controller Error: getUserStrikeHistoryController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during user strike history retrieval!',
        }));
    }
}

export {getUserStrikeStatusController, getUserStrikeHistoryController};
