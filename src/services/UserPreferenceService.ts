import "colors";
import {ClientSession} from "mongoose";
import {getUserByEmail} from "./AuthService";
import {hasInvalidItems} from "../utils/list";
import {clearRecommendationCache} from "./ContentRecommendationService";
import UserPreferenceModel, {IUserPreference} from "../models/UserPreferenceSchema";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES} from "../types/news";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    GetUserPreferenceParams,
    GetUserPreferenceResponse,
    ModifyUserPreferenceParams,
    ModifyUserPreferenceResponse,
    ResetUserPreferenceParams,
    ResetUserPreferenceResponse,
} from "../types/user-preference";

const modifyUserPreference = async (
    {email, user, preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages, session}: ModifyUserPreferenceParams): Promise<ModifyUserPreferenceResponse> => {
    try {
        const targetUser = user || (await getUserByEmail({email})).user;
        if (!targetUser) {
            return {error: generateNotFoundCode('user')};
        }

        if (preferredCategories && !Array.isArray(preferredCategories)) {
            return {error: generateInvalidCode('preferred_categories')};
        }
        if (preferredCategories && hasInvalidItems(preferredCategories, SUPPORTED_CATEGORIES)) {
            return {error: generateInvalidCode('preferred_categories')};
        }

        if (preferredSources && !Array.isArray(preferredSources)) {
            return {error: generateInvalidCode('preferred_sources')};
        }
        if (preferredSources && hasInvalidItems(preferredSources, SUPPORTED_SOURCES)) {
            return {error: generateInvalidCode('preferred_sources')};
        }

        if (newsLanguages && !Array.isArray(newsLanguages)) {
            return {error: generateInvalidCode('news_languages')};
        }
        if (newsLanguages && hasInvalidItems(newsLanguages, SUPPORTED_NEWS_LANGUAGES)) {
            return {error: generateInvalidCode('news_languages')};
        }

        const updateFields: Partial<IUserPreference> = {};
        if (typeof preferredLanguage !== 'undefined') updateFields.preferredLanguage = preferredLanguage;
        if (typeof preferredCategories !== 'undefined') updateFields.preferredCategories = preferredCategories;
        if (typeof preferredSources !== 'undefined') updateFields.preferredSources = preferredSources;
        if (typeof summaryStyle !== 'undefined') updateFields.summaryStyle = summaryStyle;
        if (typeof newsLanguages !== 'undefined') updateFields.newsLanguages = newsLanguages;

        const options: { upsert: boolean; new: boolean; runValidators: boolean; session?: ClientSession; } = {upsert: true, new: true, runValidators: true};
        if (session) {
            options.session = session;
        }

        const modifiedUserPreference: IUserPreference | null = await UserPreferenceModel.findOneAndUpdate(
            {userExternalId: targetUser.userExternalId},
            {$set: updateFields},
            options,
        );
        if (!modifiedUserPreference) {
            return {error: 'MODIFY_USER_PREFERENCE_FAILED'};
        }

        clearRecommendationCache(targetUser.userExternalId);

        return {userPreference: modifiedUserPreference};
    } catch (error: any) {
        console.error('ERROR: inside catch of modifyUserPreference:'.red.bold, error);
        throw error;
    }
}

const getUserPreference = async ({email}: GetUserPreferenceParams): Promise<GetUserPreferenceResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const userPreference: IUserPreference | null = await UserPreferenceModel.findOne({userExternalId: user.userExternalId});
        if (!userPreference) {
            return {error: 'GET_USER_PREFERENCE_FAILED'};
        }

        return {userPreference};
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserPreference:'.red.bold, error);
        throw error;
    }
}

const resetUserPreference = async ({email}: ResetUserPreferenceParams): Promise<ResetUserPreferenceResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const {modifiedCount, acknowledged} = await UserPreferenceModel.updateOne(
            {userExternalId: user.userExternalId},
            {$set: {preferredLanguage: 'en', preferredCategories: [], preferredSources: [], summaryStyle: 'standard', newsLanguages: []}},
            {runValidators: true},
        );
        if (!acknowledged) {
            return {error: 'RESET_USER_PREFERENCE_FAILED'};
        }
        if (modifiedCount !== 1) {
            return {error: generateNotFoundCode('user_preference')};
        }

        return {isReset: modifiedCount === 1};
    } catch (error: any) {
        console.error('ERROR: inside catch of resetUserPreference:'.red.bold, error);
        throw error;
    }
}

export {modifyUserPreference, getUserPreference, resetUserPreference};
