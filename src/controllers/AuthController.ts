import "colors";
import {Request, Response} from "express";
import {getAuthUrl} from "../utils/OAuth";
import {ApiResponse} from "../utils/ApiResponse";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {AuthRequest, LoginParams, RefreshTokenParams, RegisterParams, UpdateUserParams} from "../types/auth";
import {deleteAccount, getUserByEmail, loginUser, loginWithGoogle, refreshToken, registerUser, updateUser} from "../services/AuthService";

const registerUserController = async (req: Request, res: Response) => {
    console.info('registerUserController called'.bgMagenta.white.italic);

    try {
        const {name, email, password, confirmPassword}: RegisterParams = req.body;
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
        if (error === 'CREATE_USER_PREFERENCE_FAILED') {
            console.error('Failed to create user preference while creating user'.yellow.italic, error);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'CREATE_USER_PREFERENCE_FAILED',
                errorMsg: 'Failed to create user preference',
            }));
            return;
        }
        console.log('new user created:'.cyan.italic, {user, accessToken, refreshToken});

        res.status(201).send(new ApiResponse({
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
    console.info('loginController called'.bgMagenta.white.italic);

    try {
        const {email, password}: LoginParams = req.body;
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
        if (error === 'GOOGLE_USER_USE_OAUTH') {
            console.error('Google user trying email login'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'GOOGLE_USER_USE_OAUTH',
                errorMsg: 'This account uses Google Sign-In. Please use Google authentication',
                // errorMsg: 'Please sign in with Google instead. Use the "Continue with Google" button',
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
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const refreshTokenController = async (req: Request, res: Response) => {
    console.info('refreshTokenController called'.bgMagenta.white.italic);

    try {
        const {refreshToken: rawRefreshToken}: RefreshTokenParams = req.body;
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
            message: 'Token has been refreshed 🎉',
            accessToken,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of refreshTokenController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const redirectToGoogle = async (req: Request, res: Response) => {
    res.redirect(await getAuthUrl());
}

const loginWithGoogleController = async (req: Request, res: Response) => {
    console.info('loginWithGoogleController called'.bgMagenta.white.italic);

    try {
        const code = req.query.code as string;
        if (!code) {
            console.error('No code provided'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('code'),
                errorMsg: 'No code provided',
            }));
            return;
        }

        const {error, user, accessToken, refreshToken} = await loginWithGoogle({code});
        if (error === generateInvalidCode('email_address')) {
            console.error('Invalid email address'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('email_address'),
                errorMsg: 'Invalid email address',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Login successful 🎉',
            user,
            accessToken,
            refreshToken,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of loginWithGoogleController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const getUserProfileController = async (req: Request, res: Response) => {
    console.info('getUserProfileController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;

        const {user} = await getUserByEmail({email});
        if (!user) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        console.log('user profile:'.cyan.italic, {user});
        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User profile has been fetched 🎉',
            user,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserProfileController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const updateUserController = async (req: Request, res: Response) => {
    console.info('updateUserController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {name, password, profilePicture}: UpdateUserParams = req.body;
        if ('name' in req.body && (typeof name !== 'string' || !name.trim() || name.trim() === 'null')) {
            console.error('Invalid name'.yellow.italic);
            return res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('name'),
                errorMsg: 'Invalid name',
            }));
        }
        if ('password' in req.body && (typeof password !== 'string' || !password.trim() || password.trim() === 'null')) {
            console.error('Invalid password'.yellow.italic);
            return res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('password'),
                errorMsg: 'Invalid password',
            }));
        }

        const {user, error} = await updateUser({email, name, password, profilePicture});
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === generateInvalidCode('password')) {
            console.error('Invalid password'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('password'),
                errorMsg: 'Password must contain lowercase, uppercase, special character, minimum 6 characters',
            }));
            return;
        }
        if (error === 'UPDATE_USER_FAILED') {
            console.error('Update user failed'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'UPDATE_USER_FAILED',
                errorMsg: 'Couldn\'t update user',
            }));
            return;
        }
        console.log('user updated:'.cyan.italic, {user});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User has been updated 🎉',
            // user,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of updateUserController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

const deleteAccountController = async (req: Request, res: Response) => {
    console.info('deleteAccountController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;

        const {isDeleted, error} = await deleteAccount({email});
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'DELETE_ACCOUNT_FAILED') {
            console.error('Delete account failed'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'DELETE_ACCOUNT_FAILED',
                errorMsg: 'Couldn\'t delete account',
            }));
            return;
        }
        console.log('account deleted:'.cyan.italic, isDeleted);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Account has been deleted 🎉',
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of deleteAccountController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {registerUserController, loginController, refreshTokenController, redirectToGoogle, loginWithGoogleController, getUserProfileController, updateUserController, deleteAccountController};
