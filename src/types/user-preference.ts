import {SummarizationStyle, SupportedLanguage} from "./ai";
import {IUserPreference} from "../models/UserPreferenceSchema";
import {SupportedCategory, SupportedSource} from "./news";


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
    preferredLanguage?: SupportedLanguage;
    preferredCategories: SupportedCategory[];
    preferredSources: SupportedSource[];
    summaryStyle: SummarizationStyle;
}

export interface GetUserPreferenceParams {
    email: string;
}

export interface ResetUserPreferenceParams {
    email: string;
}
