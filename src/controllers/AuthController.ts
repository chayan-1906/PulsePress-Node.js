import "colors";
import {Request, Response} from "express";
import {LoginParams, RefreshTokenParams, RegisterParams} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {loginUser, refreshToken, registerUser} from "../services/AuthService";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const registerUserController = async (req: Request, res: Response) => {
    console.log('registerUserController called');

    try {
        const {name, email, password, confirmPassword}: Partial<RegisterParams> = req.body;
        if (!name) {
            console.error('Name is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('name'),
                errorMsg: 'Name is missing',
            }));
            return;
        }
        if (!email) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }
        if (!password) {
            console.error('Password is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('password'),
                errorMsg: 'Password is missing',
            }));
            return;
        }
        if (!confirmPassword) {
            console.error('Confirm password is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('confirm_password'),
                errorMsg: 'Confirm password is missing',
            }));
            return;
        }

        const {user, accessToken, refreshToken, error} = await registerUser({name, email, password, confirmPassword});
        if (error === generateInvalidCode('password')) {
            console.error('Password mismatch'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('password'),
                errorMsg: 'Password must contain lowercase, uppercase, special character, minimum 6 characters',
            }));
            return;
        }
        if (error === 'PASSWORD_MISMATCH') {
            console.error('Password mismatch'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'PASSWORD_MISMATCH',
                errorMsg: 'Passwords don\'t match',
            }));
            return;
        }
        if (error === 'ALREADY_REGISTERED') {
            console.error('User already exists'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'ALREADY_REGISTERED',
                errorMsg: 'User already exists',
            }));
            return;
        }
        console.log('new user created:'.cyan.italic, {user, accessToken, refreshToken});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Registration successful 🎉',
            user,
            accessToken,
            refreshToken,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of registerUserController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const loginController = async (req: Request, res: Response) => {
    console.log('loginController called');

    try {
        const {email, password}: Partial<LoginParams> = req.body;
        if (!email) {
            console.error('Email address is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }
        if (!password) {
            console.error('Password is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('password'),
                errorMsg: 'Password is missing',
            }));
            return;
        }

        const {user, accessToken, refreshToken, error} = await loginUser({email, password});
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === generateInvalidCode('credentials')) {
            console.error('Password mismatch'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('credentials'),
                errorMsg: 'Invalid credentials',
            }));
            return;
        }
        console.log('user loggedIn:'.cyan.italic, {user, accessToken, refreshToken});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Login successful 🎉',
            user,
            accessToken,
            refreshToken,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of loginController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const refreshTokenController = async (req: Request, res: Response) => {
    console.log('refreshTokenController called');

    try {
        const {refreshToken: rawRefreshToken}: Partial<RefreshTokenParams> = req.body;
        if (!rawRefreshToken) {
            console.error('Refresh token is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('refreshToken'),
                errorMsg: 'Refresh token is missing',
            }));
            return;
        }

        const {accessToken} = await refreshToken({refreshToken: rawRefreshToken});
        console.log('token refreshed:'.cyan.italic, {accessToken});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Token refreshed 🎉',
            accessToken,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of refreshTokenController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {registerUserController, loginController, refreshTokenController};
