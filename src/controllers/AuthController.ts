import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";

const registerUserController = async (req: Request, res: Response) => {
    console.log('registerUserController called');

    try {

    } catch (error: any) {
        console.error('ERROR: inside catch of registerUserController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const loginController = async (req: Request, res: Response) => {
    console.log('loginController called');

    try {

    } catch (error: any) {
        console.error('ERROR: inside catch of loginController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const refreshTokenController = async (req: Request, res: Response) => {
    console.log('refreshTokenController called');

    try {

    } catch (error: any) {
        console.error('ERROR: inside catch of refreshTokenController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

export {registerUserController, loginController, refreshTokenController};
