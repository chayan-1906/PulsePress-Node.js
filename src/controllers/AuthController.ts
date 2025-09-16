import "colors";
import {Request, Response} from "express";
import {getAuthUrl} from "../utils/OAuth";
import {ApiResponse} from "../utils/ApiResponse";
import AuthService from "../services/AuthService";
import MagicLinkService from "../services/MagicLinkService";
import {verifyTokenErrorHTML} from "../templates/verifyTokenErrorHTML";
import {verifyTokenSuccessHTML} from "../templates/verifyTokenSuccessHTML";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IAuthRequest,
    ICheckAuthStatusParams,
    IGenerateMagicLinkParams,
    ILoginParams,
    IRefreshTokenParams,
    IRegisterParams,
    IResetPasswordParams,
    IUpdateUserParams,
    IVerifyMagicLinkParams
} from "../types/auth";

const registerUserController = async (req: Request, res: Response) => {
    console.info('Controller: registerUserController started'.bgBlue.white.bold);

    try {
        const {name, email, password, confirmPassword}: IRegisterParams = req.body;
        if (!name) {
            console.warn('Client Error: Missing name parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('name'),
                errorMsg: 'Name is missing',
            }));
            return;
        }
        if (!email) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }
        if (!password) {
            console.warn('Client Error: Missing password parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('password'),
                errorMsg: 'Password is missing',
            }));
            return;
        }
        if (!confirmPassword) {
            console.warn('Client Error: Missing confirm password parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('confirm_password'),
                errorMsg: 'Confirm password is missing',
            }));
            return;
        }

        const {user, error} = await AuthService.registerUser({name, email, password, confirmPassword});

        if (error) {
            let errorMsg = 'Failed to register user';
            let statusCode = 500;

            if (error === generateMissingCode('name')) {
                errorMsg = 'Name is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('password')) {
                errorMsg = 'Password is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('confirm_password')) {
                errorMsg = 'Confirm password is missing';
                statusCode = 400;
            } else if (error === generateInvalidCode('password')) {
                errorMsg = 'Password must contain lowercase, uppercase, special character, minimum 6 characters';
                statusCode = 400;
            } else if (error === 'PASSWORD_MISMATCH') {
                errorMsg = 'Passwords don\'t match';
                statusCode = 400;
            } else if (error === 'ALREADY_REGISTERED') {
                errorMsg = 'User already exists';
                statusCode = 400;
            } else if (error === 'CREATE_USER_PREFERENCE_FAILED') {
                errorMsg = 'Failed to create user preference';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: User registration completed'.bgGreen.bold, {user});

        res.status(201).send(new ApiResponse({
            success: true,
            message: 'Registration successful! Check your email to verify your account',
        }));
    } catch (error: any) {
        console.error('Controller Error: registerUserController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during user registration',
        }));
    }
}

const loginController = async (req: Request, res: Response) => {
    console.info('Controller: loginController started'.bgBlue.white.bold);

    try {
        const {email, password}: ILoginParams = req.body;
        if (!email) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }
        if (!password) {
            console.warn('Client Error: Missing password parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('password'),
                errorMsg: 'Password is missing',
            }));
            return;
        }

        const {user, accessToken, refreshToken, error} = await AuthService.loginUser({email, password});

        if (error) {
            let errorMsg = 'Failed to login user';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'USER_NOT_VERIFIED') {
                errorMsg = 'User not verified';
                statusCode = 400;
            } else if (error === generateInvalidCode('credentials')) {
                errorMsg = 'Invalid credentials';
                statusCode = 400;
            } else if (error === 'GOOGLE_OAUTH_USER') {
                errorMsg = 'This account uses Google Sign-In. Please use Google authentication';
                statusCode = 400;
            } else if (error === 'MAGIC_LINK_USER') {
                errorMsg = 'This account uses Magic Link Sign-In. Please use Magic Link Authentication';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: User login completed'.bgGreen.bold, {user});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Login successful 🎉',
            user,
            accessToken,
            refreshToken,
        }));
    } catch (error: any) {
        console.error('Controller Error: loginController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during user login',
        }));
    }
}

const resetPasswordController = async (req: Request, res: Response) => {
    console.info('Controller: resetPasswordController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {currentPassword, newPassword}: IResetPasswordParams = req.body;
        if (!email) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }

        const {user, error} = await AuthService.resetPassword({email, currentPassword, newPassword});

        if (error) {
            let errorMsg = 'Failed to reset password';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'NO_PASSWORD_SET') {
                errorMsg = 'No password has been set';
                statusCode = 400;
            } else if (error === generateMissingCode('current_password')) {
                errorMsg = 'Current password is missing';
                statusCode = 400;
            } else if (error === generateMissingCode('new_password')) {
                errorMsg = 'New password is missing';
                statusCode = 400;
            } else if (error === generateInvalidCode('credentials')) {
                errorMsg = 'Wrong current password';
                statusCode = 400;
            } else if (error === 'SAME_PASSWORD') {
                errorMsg = 'Current and new password can\'t be same';
                statusCode = 400;
            } else if (error === generateInvalidCode('new_password')) {
                errorMsg = 'Password must contain lowercase, uppercase, special character, minimum 6 characters';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: Password reset completed'.bgGreen.bold, {user});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Password reset has been successful 🎉',
        }));
    } catch (error: any) {
        console.error('Controller Error: resetPasswordController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during password reset',
        }));
    }
}

const refreshTokenController = async (req: Request, res: Response) => {
    console.info('Controller: refreshTokenController started'.bgBlue.white.bold);

    try {
        const {refreshToken: rawRefreshToken}: IRefreshTokenParams = req.body;
        if (!rawRefreshToken) {
            console.warn('Client Error: Missing refresh token parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('refresh_token'),
                errorMsg: 'Refresh token is missing',
            }));
            return;
        }

        const {accessToken, error} = await AuthService.refreshToken({refreshToken: rawRefreshToken});

        if (error) {
            let errorMsg = 'Failed to refresh token';
            let statusCode = 500;

            if (error === generateMissingCode('refresh_token')) {
                errorMsg = 'Refresh token is missing';
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

        console.log('SUCCESS: Access token refreshed'.bgGreen.bold);

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Token has been refreshed 🎉',
            accessToken,
        }));
    } catch (error: any) {
        console.error('Controller Error: refreshTokenController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during token refresh',
        }));
    }
}

const redirectToGoogle = async (req: Request, res: Response) => {
    res.redirect(await getAuthUrl());
}

const loginWithGoogleController = async (req: Request, res: Response) => {
    console.info('Controller: loginWithGoogleController started'.bgBlue.white.bold);

    try {
        const code = req.query.code as string;
        if (!code) {
            console.warn('Client Error: Missing OAuth code parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('code'),
                errorMsg: 'No code provided',
            }));
            return;
        }

        const {error, user, accessToken, refreshToken} = await AuthService.loginWithGoogle({code});

        if (error) {
            let errorMsg = 'Failed to login with Google';
            let statusCode = 500;

            if (error === generateInvalidCode('email_address')) {
                errorMsg = 'Invalid email address';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
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
        console.error('Controller Error: loginWithGoogleController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during google login',
        }));
    }
}

const generateMagicLinkController = async (req: Request, res: Response) => {
    console.info('Controller: generateMagicLinkController started'.bgBlue.white.bold);

    try {
        const {email}: IGenerateMagicLinkParams = req.body;
        if (!email) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is required',
            }));
            return;
        }

        const {success, message} = await MagicLinkService.generateMagicLink({email});
        console.log('SUCCESS: Magic link generated'.bgGreen.bold, {success});
        res.status(200).send(new ApiResponse({
            success,
            message,
        }));
    } catch (error: any) {
        console.error('Controller Error: generateMagicLinkController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during magic link login',
        }));
    }
}

const verifyMagicLinkController = async (req: Request, res: Response) => {
    console.info('Controller: verifyMagicLinkController started'.bgBlue.white.bold);

    try {
        const {token}: Partial<IVerifyMagicLinkParams> = req.query;
        if (!token) {
            console.warn('Client Error: Missing token parameter'.yellow);
            res.send(verifyTokenErrorHTML);
            return;
        }

        const {user, accessToken, refreshToken, error} = await MagicLinkService.verifyMagicLink({token});

        if (error) {
            if (error === generateInvalidCode('magic_link')) {
                console.warn('Client Error: Invalid magic link'.yellow, {error});
                res.send(verifyTokenErrorHTML);
                return;
            } else if (error === 'CREATE_USER_PREFERENCE_FAILED') {
                console.warn('Client Error: User preference creation failed during registration'.yellow, {error});
                res.status(400).send(new ApiResponse({
                    success: false,
                    errorCode: 'CREATE_USER_PREFERENCE_FAILED',
                    errorMsg: 'Failed to create user preference',
                }));
                return;
            } else {
                console.warn('Client Error: Magic link verification failed'.yellow, {error});
                res.send(verifyTokenErrorHTML);
                return;
            }
        }

        console.log('SUCCESS: Magic link verification completed'.bgGreen.bold, {user});
        res.send(verifyTokenSuccessHTML);
    } catch (error: any) {
        console.error('Controller Error: verifyMagicLinkController failed'.red.bold, error);
        res.send(verifyTokenErrorHTML);
    }
}

const checkAuthStatusController = async (req: Request, res: Response) => {
    console.info('Controller: checkAuthStatusController started'.bgBlue.white.bold);

    try {
        const {email}: ICheckAuthStatusParams = req.body;
        if (!email) {
            console.warn('Client Error: Missing email parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email address is missing',
            }));
            return;
        }

        const {authenticated, user, accessToken, refreshToken, error} = await MagicLinkService.checkAuthStatus({email});

        if (error) {
            let errorMsg = 'Failed to check auth status';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error === generateNotFoundCode('user') ? error : 'AUTH_STATUS_CHECK_FAILED',
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: Auth status verified'.bgGreen.bold, {authenticated, user});
        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Auth status has been checked 🎉',
            authenticated,
            user,
            accessToken,
            refreshToken,
        }));
    } catch (error: any) {
        console.error('Controller Error: checkAuthStatusController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong while checking authentication status',
        }));
    }
}

const getUserProfileController = async (req: Request, res: Response) => {
    console.info('Controller: getUserProfileController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {user} = await AuthService.getUserByEmail({email});
        if (!user) {
            console.warn('Client Error: User not found'.yellow);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        console.log('SUCCESS: User profile fetched'.bgGreen.bold, {userEmail: user?.email});
        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User profile has been fetched 🎉',
            user,
        }));
    } catch (error: any) {
        console.error('Controller Error: getUserProfileController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during user profile retrieval',
        }));
    }
}

const updateUserController = async (req: Request, res: Response) => {
    console.info('Controller: updateUserController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {name, password, profilePicture}: IUpdateUserParams = req.body;
        if ('name' in req.body && (typeof name !== 'string' || !name.trim() || name.trim() === 'null')) {
            console.warn('Client Error: Invalid name parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('name'),
                errorMsg: 'Invalid name',
            }));
            return;
        }
        if ('password' in req.body && (typeof password !== 'string' || !password.trim() || password.trim() === 'null')) {
            console.warn('Client Error: Invalid password parameter'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('password'),
                errorMsg: 'Invalid password',
            }));
            return;
        }

        const {user, error} = await AuthService.updateUser({email, name, password, profilePicture});

        if (error) {
            let errorMsg = 'Failed to update user';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === generateInvalidCode('password')) {
                errorMsg = 'Password must contain lowercase, uppercase, special character, minimum 6 characters';
                statusCode = 400;
            } else if (error === 'UPDATE_USER_FAILED') {
                errorMsg = 'Couldn\'t update user';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: User profile updated'.bgGreen.bold, {user});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User has been updated 🎉',
            // user,
        }));
    } catch (error: any) {
        console.error('Controller Error: updateUserController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong while updating user profile',
        }));
    }
}

const deleteAccountController = async (req: Request, res: Response) => {
    console.info('Controller: deleteAccountController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {isDeleted, error} = await AuthService.deleteAccount({email});

        if (error) {
            let errorMsg = 'Failed to delete account';
            let statusCode = 500;

            if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'DELETE_ACCOUNT_FAILED') {
                errorMsg = 'Couldn\'t delete account';
                statusCode = 400;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }
        console.log('SUCCESS: User account deleted'.bgGreen.bold, {deleted: isDeleted});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Account has been deleted 🎉',
        }));
    } catch (error: any) {
        console.error('Controller Error: deleteAccountController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong during account deletion',
        }));
    }
}

export {
    registerUserController,
    loginController,
    resetPasswordController,
    refreshTokenController,
    redirectToGoogle,
    loginWithGoogleController,
    generateMagicLinkController,
    verifyMagicLinkController,
    checkAuthStatusController,
    getUserProfileController,
    updateUserController,
    deleteAccountController,
};
