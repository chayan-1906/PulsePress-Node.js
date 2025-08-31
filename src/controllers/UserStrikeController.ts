import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {GetUserStrikeHistoryParams} from "../types/ai";
import UserStrikeService from "../services/UserStrikeService";
import {generateNotFoundCode} from "../utils/generateErrorCodes";

const getUserStrikeStatusController = async (req: Request, res: Response) => {
    console.info('Controller: getUserStrikeStatusController started'.bgBlue.white.bold);

    try {
        const email = (req as AuthRequest).email;

        const {strikeStatus, error} = await UserStrikeService.getUserStrikeStatus({email});
        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.warn('Client Error: User not found'.yellow);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }
            if (error === 'STRIKE_DATA_UNAVAILABLE') {
                console.warn('Client Error: Strike data unavailable'.yellow);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: 'STRIKE_DATA_UNAVAILABLE',
                    errorMsg: 'Strike data unavailable',
                }));
                return;
            }
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
        const email = (req as AuthRequest).email;
        const {limit}: Partial<GetUserStrikeHistoryParams> = req.query;

        let limitNumber = 10;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }

        const {strikeHistory, totalStrikes, error} = await UserStrikeService.getUserStrikeHistory({email, limit: limitNumber});
        if (error) {
            if (error === generateNotFoundCode('user')) {
                console.warn('Client Error: User not found'.yellow);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: generateNotFoundCode('user'),
                    errorMsg: 'User not found',
                }));
                return;
            }
            if (error === 'STRIKE_DATA_UNAVAILABLE') {
                console.warn('Client Error: Strike data unavailable'.yellow);
                res.status(404).send(new ApiResponse({
                    success: false,
                    errorCode: 'STRIKE_DATA_UNAVAILABLE',
                    errorMsg: 'Strike data unavailable',
                }));
                return;
            }
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
