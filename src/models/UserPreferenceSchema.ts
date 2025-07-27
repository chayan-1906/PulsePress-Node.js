import {Document, Model, model, Schema} from "mongoose";
import generateNanoIdWithAlphabet from "../utils/generateUUID";
import {SUMMARIZATION_STYLES, SummarizationStyle, SUPPORTED_LANGUAGES, SupportedLanguage} from "../types/ai";
import {SUPPORTED_CATEGORIES, SUPPORTED_NEWS_LANGUAGES, SUPPORTED_SOURCES, SupportedCategory, SupportedNewsLanguage, SupportedSource} from "../types/news";

export interface IUserPreference extends Document {
    userPreferenceId: string;
    userPreferenceExternalId: string;
    userExternalId: string;
    preferredLanguage: SupportedLanguage;
    preferredCategories: SupportedCategory[];
    preferredSources: SupportedSource[];
    summaryStyle: SummarizationStyle;
    newsLanguages: SupportedNewsLanguage[];
    createdAt: Date;
    updatedAt: Date;
}

interface IUserPreferenceModel extends Model<IUserPreference> {
}

const UserPreferenceSchema = new Schema<IUserPreference>({
    userPreferenceExternalId: {
        type: String,
        unique: true,
        required: true,
        default: () => generateNanoIdWithAlphabet(),
    },
    userExternalId: {
        type: String,
        unique: true,
        required: true,
    },
    preferredLanguage: {
        type: String,
        required: true,
        enum: SUPPORTED_LANGUAGES,
    },
    preferredCategories: {
        type: [String],
        required: true,
        enum: SUPPORTED_CATEGORIES,
    },
    preferredSources: {
        type: [String],
        required: true,
        enum: SUPPORTED_SOURCES,
    },
    summaryStyle: {
        type: String,
        required: true,
        enum: SUMMARIZATION_STYLES,
    },
    newsLanguages: {
        type: [String],
        required: true,
        enum: SUPPORTED_NEWS_LANGUAGES,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.userPreferenceId = String(ret._id);
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    }
});

const UserPreferenceModel: IUserPreferenceModel = model<IUserPreference, IUserPreferenceModel>('UserPreference', UserPreferenceSchema);

export default UserPreferenceModel;
