import "colors";
import {Request, Response} from "express";
import {IAuthRequest} from "../types/auth";
import {hasInvalidItems} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import {IModifyUserPreferenceParams} from "../types/user-preference";
import UserPreferenceService from "../services/UserPreferenceService";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES} from "../types/news";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const modifyUserPreferenceController = async (req: Request, res: Response) => {
    console.info('Controller: modifyUserPreferenceController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;
        const {preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages}: IModifyUserPreferenceParams = req.body;

        if (preferredCategories && !Array.isArray(preferredCategories)) {
            console.warn('Client Error: Invalid preferred categories format'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_categories'),
                errorMsg: 'Preferred categories must be an array of strings',
            }));
            return;
        }
        if (preferredCategories && hasInvalidItems(preferredCategories, SUPPORTED_CATEGORIES)) {
            console.warn('Client Error: Unsupported preferred categories'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_categories'),
                errorMsg: `Preferred categories must be one of: ${SUPPORTED_CATEGORIES.join(', ')}`,
            }));
            return;
        }

        if (preferredSources && !Array.isArray(preferredSources)) {
            console.warn('Client Error: Invalid preferred sources format'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_sources'),
                errorMsg: 'Preferred sources must be an array of strings',
            }));
            return;
        }
        if (preferredSources && hasInvalidItems(preferredSources, SUPPORTED_SOURCES)) {
            console.warn('Client Error: Unsupported preferred sources'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_sources'),
                errorMsg: `Preferred sources must be one of: ${SUPPORTED_SOURCES.join(', ')}`,
            }));
            return;
        }

        if (newsLanguages && !Array.isArray(newsLanguages)) {
            console.warn('Client Error: Invalid news languages format'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('news_languages'),
                errorMsg: 'News languages must be an array of strings',
            }));
            return;
        }
        if (newsLanguages && hasInvalidItems(newsLanguages, SUPPORTED_NEWS_LANGUAGES)) {
            console.warn('Client Error: Unsupported news languages'.yellow);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('news_languages'),
                errorMsg: `News languages must be one of: ${SUPPORTED_NEWS_LANGUAGES.join(', ')}`,
            }));
            return;
        }

        const {userPreference, error} = await UserPreferenceService.modifyUserPreference({email, preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages});

        if (error) {
            let errorMsg = 'Failed to modify user preference';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'MODIFY_USER_PREFERENCE_FAILED') {
                errorMsg = 'Failed to modify user preference';
                statusCode = 500;
            } else if (error === generateNotFoundCode('user_preference')) {
                errorMsg = 'User preference not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: User preference modified'.bgGreen.bold, {userEmail: email});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been modified 🎉',
            userPreference,
        }));
    } catch (error: any) {
        console.error('Controller Error: modifyUserPreferenceController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during user preference modifications',
        }));
    }
}

const getUserPreferenceController = async (req: Request, res: Response) => {
    console.info('Controller: getUserPreferenceController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {userPreference, error} = await UserPreferenceService.getUserPreference({email});

        if (error) {
            let errorMsg = 'Failed to get user preference';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'GET_USER_PREFERENCE_FAILED') {
                errorMsg = 'Failed to get user preference';
                statusCode = 500;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: User preference fetched'.bgGreen.bold, {userEmail: email});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been fetched 🎉',
            userPreference,
        }));
    } catch (error: any) {
        console.error('Controller Error: getUserPreferenceController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during user preference retrieval',
        }));
    }
}

const resetUserPreferenceController = async (req: Request, res: Response) => {
    console.info('Controller: resetUserPreferenceController started'.bgBlue.white.bold);

    try {
        const email = (req as IAuthRequest).email;

        const {isReset, error} = await UserPreferenceService.resetUserPreference({email});

        if (error) {
            let errorMsg = 'Failed to reset user preference';
            let statusCode = 500;

            if (error === generateMissingCode('email')) {
                errorMsg = 'Email is missing';
                statusCode = 400;
            } else if (error === generateNotFoundCode('user')) {
                errorMsg = 'User not found';
                statusCode = 404;
            } else if (error === 'RESET_USER_PREFERENCE_FAILED') {
                errorMsg = 'Failed to reset user preference';
                statusCode = 500;
            } else if (error === generateNotFoundCode('user_preference')) {
                errorMsg = 'User preference not found';
                statusCode = 404;
            }

            res.status(statusCode).send(new ApiResponse({
                success: false,
                errorCode: error,
                errorMsg,
            }));
            return;
        }

        console.log('SUCCESS: User preference reset'.bgGreen.bold, {userEmail: email, isReset});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been reset 🎉',
            isReset,
        }));
    } catch (error: any) {
        console.error('Controller Error: resetUserPreferenceController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during user preference reset',
        }));
    }
}

export {modifyUserPreferenceController, getUserPreferenceController, resetUserPreferenceController};
