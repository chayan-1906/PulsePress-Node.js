import "colors";
import {ClientSession} from "mongoose";
import {hasInvalidItems} from "../list";
import {generateInvalidCode} from "../generateErrorCodes";
import {IUserPreference} from "../../models/UserPreferenceSchema";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES} from "../../types/news";

/**
 * Validate user preference arrays against supported values
 */
const validateUserPreferenceArrays = (preferredCategories?: string[], preferredSources?: string[], newsLanguages?: string[]): { isValid: boolean; error?: string } => {
    console.log('Service: validateUserPreferenceArrays called'.cyan.italic, {preferredCategories, preferredSources, newsLanguages});

    // Validate preferred categories
    if (preferredCategories && !Array.isArray(preferredCategories)) {
        console.warn('Client Error: Invalid preferred categories - not an array'.yellow, {preferredCategories});
        return {isValid: false, error: generateInvalidCode('preferred_categories')};
    }
    if (preferredCategories && hasInvalidItems(preferredCategories, SUPPORTED_CATEGORIES)) {
        console.warn('Client Error: Invalid preferred categories - unsupported values'.yellow, {preferredCategories});
        return {isValid: false, error: generateInvalidCode('preferred_categories')};
    }

    // Validate preferred sources
    if (preferredSources && !Array.isArray(preferredSources)) {
        console.warn('Client Error: Invalid preferred sources - not an array'.yellow, {preferredSources});
        return {isValid: false, error: generateInvalidCode('preferred_sources')};
    }
    if (preferredSources && hasInvalidItems(preferredSources, SUPPORTED_SOURCES)) {
        console.warn('Client Error: Invalid preferred sources - unsupported values'.yellow, {preferredSources});
        return {isValid: false, error: generateInvalidCode('preferred_sources')};
    }

    // Validate news languages
    if (newsLanguages && !Array.isArray(newsLanguages)) {
        console.warn('Client Error: Invalid news languages - not an array'.yellow, {newsLanguages});
        return {isValid: false, error: generateInvalidCode('news_languages')};
    }
    if (newsLanguages && hasInvalidItems(newsLanguages, SUPPORTED_NEWS_LANGUAGES)) {
        console.warn('Client Error: Invalid news languages - unsupported values'.yellow, {newsLanguages});
        return {isValid: false, error: generateInvalidCode('news_languages')};
    }

    return {isValid: true};
}

/**
 * Build update fields object for user preferences
 */
const buildUserPreferenceUpdateFields = (preferredLanguage?: string, preferredCategories?: string[], preferredSources?: string[], summaryStyle?: string, newsLanguages?: string[]): Partial<IUserPreference> => {
    console.log('Service: buildUserPreferenceUpdateFields called'.cyan.italic, {preferredLanguage, preferredCategories, preferredSources, summaryStyle, newsLanguages});

    const updateFields: Partial<IUserPreference> = {};

    if (typeof preferredLanguage !== 'undefined') updateFields.preferredLanguage = preferredLanguage;
    if (typeof preferredCategories !== 'undefined') updateFields.preferredCategories = preferredCategories;
    if (typeof preferredSources !== 'undefined') updateFields.preferredSources = preferredSources;
    if (typeof summaryStyle !== 'undefined') updateFields.summaryStyle = summaryStyle;
    if (typeof newsLanguages !== 'undefined') updateFields.newsLanguages = newsLanguages;

    return updateFields;
}

/**
 * Build database options for user preference operations
 */
const buildUserPreferenceDbOptions = (session?: ClientSession) => {
    console.log('Service: buildUserPreferenceDbOptions called'.cyan.italic, {hasSession: !!session});

    const options: { upsert: boolean; new: boolean; runValidators: boolean; session?: ClientSession; } = {
        upsert: true,
        new: true,
        runValidators: true
    };

    if (session) {
        options.session = session;
    }

    return options;
}

export {validateUserPreferenceArrays, buildUserPreferenceUpdateFields, buildUserPreferenceDbOptions};
