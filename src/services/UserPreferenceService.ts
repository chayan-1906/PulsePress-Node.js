import "colors";
import AuthService from "./AuthService";
import {clearRecommendationCache} from "./ContentRecommendationService";
import UserPreferenceModel, {IUserPreference} from "../models/UserPreferenceSchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {buildUserPreferenceDbOptions, buildUserPreferenceUpdateFields, validateUserPreferenceArrays} from "../utils/serviceHelpers/userPreferenceHelpers";
import {
    IGetUserPreferenceParams,
    IGetUserPreferenceResponse,
    IModifyUserPreferenceParams,
    IModifyUserPreferenceResponse,
    IResetUserPreferenceParams,
    IResetUserPreferenceResponse,
} from "../types/user-preference";

class UserPreferenceService {
    /**
     * Create or update user preferences with validation and cache invalidation
     */
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

            // Validate array inputs
            const validation = validateUserPreferenceArrays(preferredCategories, preferredSources, newsLanguages);
            if (!validation.isValid) {
                return {error: validation.error!};
            }

            const updateFields = buildUserPreferenceUpdateFields(preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages);

            const options = buildUserPreferenceDbOptions(session);

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

    /**
     * Retrieve user preferences by email
     */
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

    /**
     * Reset user preferences to default values
     */
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
