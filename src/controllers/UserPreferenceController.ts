import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {hasInvalidItems} from "../utils/list";
import {ApiResponse} from "../utils/ApiResponse";
import {ModifyUserPreferenceParams} from "../types/user-preference";
import UserPreferenceService from "../services/UserPreferenceService";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES} from "../types/news";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const modifyUserPreferenceController = async (req: Request, res: Response) => {
    console.log('modifyUserPreferenceController called');

    try {
        const email = (req as AuthRequest).email;
        const {preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages}: ModifyUserPreferenceParams = req.body;

        if (preferredCategories && !Array.isArray(preferredCategories)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_categories'),
                errorMsg: 'Preferred categories must be an array of strings',
            }));
            return;
        }
        if (preferredCategories && hasInvalidItems(preferredCategories, SUPPORTED_CATEGORIES)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_categories'),
                errorMsg: `Preferred categories must be one of: ${SUPPORTED_CATEGORIES.join(', ')}`,
            }));
            return;
        }

        if (preferredSources && !Array.isArray(preferredSources)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_sources'),
                errorMsg: 'Preferred sources must be an array of strings',
            }));
            return;
        }
        if (preferredSources && hasInvalidItems(preferredSources, SUPPORTED_SOURCES)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('preferred_sources'),
                errorMsg: `Preferred sources must be one of: ${SUPPORTED_SOURCES.join(', ')}`,
            }));
            return;
        }

        if (newsLanguages && !Array.isArray(newsLanguages)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('news_languages'),
                errorMsg: 'News languages must be an array of strings',
            }));
            return;
        }
        if (newsLanguages && hasInvalidItems(newsLanguages, SUPPORTED_NEWS_LANGUAGES)) {
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('news_languages'),
                errorMsg: `News languages must be one of: ${SUPPORTED_NEWS_LANGUAGES.join(', ')}`,
            }));
            return;
        }

        const {userPreference, error} = await UserPreferenceService.modifyUserPreference({email, preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages});
        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        if (error === 'MODIFY_USER_PREFERENCE_FAILED') {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'MODIFY_USER_PREFERENCE_FAILED',
                errorMsg: 'Failed to modify user preference',
            }));
            return;
        }
        if (error === generateNotFoundCode('user_preference')) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user_preference'),
                errorMsg: 'User preference not found',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been modified 🎉',
            userPreference,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of modifyUserPreferenceController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const getUserPreferenceController = async (req: Request, res: Response) => {
    console.log('getUserPreferenceController called');

    try {
        const email = (req as AuthRequest).email;

        const {userPreference, error} = await UserPreferenceService.getUserPreference({email});
        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        if (error === 'GET_USER_PREFERENCE_FAILED') {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'GET_USER_PREFERENCE_FAILED',
                errorMsg: 'Failed to get user preference',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been fetched 🎉',
            userPreference,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserPreferenceController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

const resetUserPreferenceController = async (req: Request, res: Response) => {
    console.log('resetUserPreferenceController called');
    try {
        const email = (req as AuthRequest).email;

        const {isReset, error} = await UserPreferenceService.resetUserPreference({email});
        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }

        if (error === 'RESET_USER_PREFERENCE_FAILED') {
            res.status(500).send(new ApiResponse({
                success: false,
                errorCode: 'RESET_USER_PREFERENCE_FAILED',
                errorMsg: 'Failed to reset user preference',
            }));
            return;
        }
        if (error === generateNotFoundCode('user_preference')) {
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user_preference'),
                errorMsg: 'User preference not found',
            }));
            return;
        }

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'User preference has been reset 🎉',
            isReset,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of resetUserPreferenceController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong',
        }));
    }
}

export {modifyUserPreferenceController, getUserPreferenceController, resetUserPreferenceController};
