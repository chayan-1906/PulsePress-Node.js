import {SummarizationStyle, SupportedLanguage} from "./ai";
import {IUserPreference} from "../models/UserPreferenceSchema";
import {SupportedCategory, SupportedSource} from "./news";
import {ClientSession} from "mongoose";
import {IUser} from "../models/UserSchema";


/** ------------- API response types ------------- */

export interface ModifyUserPreferenceResponse {
    userPreference?: IUserPreference | null;
    error?: string;
}

export interface GetUserPreferenceResponse {
    userPreference?: IUserPreference | null;
    error?: string;
}

export interface ResetUserPreferenceResponse {
    isReset?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface ModifyUserPreferenceParams {
    email: string;
    user?: IUser | null;
    preferredLanguage?: SupportedLanguage;
    preferredCategories: SupportedCategory[];
    preferredSources: SupportedSource[];
    summaryStyle: SummarizationStyle;
    session?: ClientSession;
}

export interface GetUserPreferenceParams {
    email: string;
}

export interface ResetUserPreferenceParams {
    email: string;
}
