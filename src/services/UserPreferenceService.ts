import "colors";
import {ClientSession} from "mongoose";
import AuthService from "./AuthService";
import {hasInvalidItems} from "../utils/list";
import {clearRecommendationCache} from "./ContentRecommendationService";
import UserPreferenceModel, {IUserPreference} from "../models/UserPreferenceSchema";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES} from "../types/news";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    IGetUserPreferenceParams,
    IGetUserPreferenceResponse,
    IModifyUserPreferenceParams,
    IModifyUserPreferenceResponse,
    IResetUserPreferenceParams,
    IResetUserPreferenceResponse,
} from "../types/user-preference";

class UserPreferenceService {
    static async modifyUserPreference(
        {email, user, preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages, session}: IModifyUserPreferenceParams): Promise<IModifyUserPreferenceResponse> {
        console.log('Service: UserPreferenceService.modifyUserPreference called'.cyan.italic, {
            email,
            user,
            preferredLanguage,
            preferredCategories,
            preferredSources,
            summaryStyle,
            newsLanguages,
            session,
        });

        try {
            const targetUser = user || (await AuthService.getUserByEmail({email})).user;
            if (!targetUser) {
                return {error: generateNotFoundCode('user')};
            }

            if (preferredCategories && !Array.isArray(preferredCategories)) {
                console.warn('Client Error: Invalid preferred categories - not an array'.yellow, {preferredCategories});
                return {error: generateInvalidCode('preferred_categories')};
            }
            if (preferredCategories && hasInvalidItems(preferredCategories, SUPPORTED_CATEGORIES)) {
                console.warn('Client Error: Invalid preferred categories - unsupported values'.yellow, {preferredCategories});
                return {error: generateInvalidCode('preferred_categories')};
            }

            if (preferredSources && !Array.isArray(preferredSources)) {
                console.warn('Client Error: Invalid preferred sources - not an array'.yellow, {preferredSources});
                return {error: generateInvalidCode('preferred_sources')};
            }
            if (preferredSources && hasInvalidItems(preferredSources, SUPPORTED_SOURCES)) {
                console.warn('Client Error: Invalid preferred sources - unsupported values'.yellow, {preferredSources});
                return {error: generateInvalidCode('preferred_sources')};
            }

            if (newsLanguages && !Array.isArray(newsLanguages)) {
                console.warn('Client Error: Invalid news languages - not an array'.yellow, {newsLanguages});
                return {error: generateInvalidCode('news_languages')};
            }
            if (newsLanguages && hasInvalidItems(newsLanguages, SUPPORTED_NEWS_LANGUAGES)) {
                console.warn('Client Error: Invalid news languages - unsupported values'.yellow, {newsLanguages});
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

            console.log('User preference modification completed successfully'.green.bold, {userPreference: modifiedUserPreference});
            return {userPreference: modifiedUserPreference};
        } catch (error: any) {
            console.error('Service Error: UserPreferenceService.modifyUserPreference failed:'.red.bold, error);
            throw error;
        }
    }

    static async getUserPreference({email}: IGetUserPreferenceParams): Promise<IGetUserPreferenceResponse> {
        console.log('Service: UserPreferenceService.getUserPreference called'.cyan.italic, {email});

        try {
            if (!email) {
                console.warn('Client Error: Missing email parameter'.yellow);
                return {error: generateMissingCode('email')};
            }

            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const userPreference: IUserPreference | null = await UserPreferenceModel.findOne({userExternalId: user.userExternalId});
            if (!userPreference) {
                return {error: 'GET_USER_PREFERENCE_FAILED'};
            }

            console.log('User preference retrieval completed successfully'.green.bold, {userPreference});
            return {userPreference};
        } catch (error: any) {
            console.error('Service Error: UserPreferenceService.getUserPreference failed:'.red.bold, error);
            throw error;
        }
    }

    static async resetUserPreference({email}: IResetUserPreferenceParams): Promise<IResetUserPreferenceResponse> {
        console.log('Service: UserPreferenceService.resetUserPreference called'.cyan.italic, {email});

        try {
            if (!email) {
                console.warn('Client Error: Missing email parameter'.yellow);
                return {error: generateMissingCode('email')};
            }

            const {user} = await AuthService.getUserByEmail({email});
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

            const isReset = modifiedCount === 1;
            console.log('User preference reset completed successfully'.green.bold, {isReset});
            return {isReset};
        } catch (error: any) {
            console.error('Service Error: UserPreferenceService.resetUserPreference failed:'.red.bold, error);
            throw error;
        }
    }
}

export default UserPreferenceService;
