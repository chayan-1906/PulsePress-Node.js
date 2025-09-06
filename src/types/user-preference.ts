import {ClientSession} from "mongoose";
import {IUser} from "../models/UserSchema";
import {TSummarizationStyle, TSupportedLanguage} from "./ai";
import {IUserPreference} from "../models/UserPreferenceSchema";
import {TSupportedCategory, TSupportedNewsLanguage, TSupportedSource} from "./news";


/** ------------- API response types ------------- */

export interface IModifyUserPreferenceResponse {
    userPreference?: IUserPreference | null;
    error?: string;
}

export interface IGetUserPreferenceResponse {
    userPreference?: IUserPreference | null;
    error?: string;
}

export interface IResetUserPreferenceResponse {
    isReset?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface IModifyUserPreferenceParams {
    email: string;  // for authMiddleware
    user?: IUser | null;
    preferredLanguage?: TSupportedLanguage;
    preferredCategories?: TSupportedCategory[];
    preferredSources?: TSupportedSource[];
    summaryStyle?: TSummarizationStyle;
    newsLanguages?: TSupportedNewsLanguage[];
    session?: ClientSession;
}

export interface IGetUserPreferenceParams {
    email: string;  // for authMiddleware
}

export interface IResetUserPreferenceParams {
    email: string;  // for authMiddleware
}
