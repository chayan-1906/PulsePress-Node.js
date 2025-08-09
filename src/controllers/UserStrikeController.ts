import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {GetUserStrikeHistoryParams} from "../types/ai";
import {generateNotFoundCode} from "../utils/generateErrorCodes";
import {getUserStrikeHistory, getUserStrikeStatus} from "../services/UserStrikeService";

const getUserStrikeStatusController = async (req: Request, res: Response) => {
    console.info('getUserStrikeStatusController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;

        const {strikeStatus, error} = await getUserStrikeStatus({email});
        if (error === 'USER_NOT_FOUND') {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'STRIKE_DATA_UNAVAILABLE') {
            console.error('Strike data unavailable'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: 'STRIKE_DATA_UNAVAILABLE',
                errorMsg: 'Strike data unavailable',
            }));
            return;
        }

        console.log('user strike status:'.cyan.italic, strikeStatus);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Strike status has been fetched 🎉',
            strikeStatus,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserStrikeStatusController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const getUserStrikeHistoryController = async (req: Request, res: Response) => {
    console.info('getUserStrikeHistoryController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {limit}: Partial<GetUserStrikeHistoryParams> = req.query;

        let limitNumber = 10;
        if (limit && !isNaN(Number(limit))) {
            limitNumber = Number(limit);
        }

        const {strikeHistory, totalStrikes, error} = await getUserStrikeHistory({email, limit: limitNumber});
        if (error === 'USER_NOT_FOUND') {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'STRIKE_DATA_UNAVAILABLE') {
            console.error('Strike data unavailable'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: 'STRIKE_DATA_UNAVAILABLE',
                errorMsg: 'Strike data unavailable',
            }));
            return;
        }

        console.log('user strike history:'.cyan.italic, {strikeHistory, totalStrikes});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Strike history has been fetched 🎉',
            strikeHistory,
            totalStrikes,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserStrikeHistoryController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {getUserStrikeStatusController, getUserStrikeHistoryController};
