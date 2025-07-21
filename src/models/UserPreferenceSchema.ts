import {Document, Model, model, Schema} from "mongoose";
import {SUMMARIZATION_STYLES, SummarizationStyle, SUPPORTED_LANGUAGES, SupportedLanguage} from "../types/ai";

export interface IUserPreference extends Document {
    userExternalId: string;
    preferredLanguage: SupportedLanguage;
    preferredCategories: string[];
    preferredSources: string[];
    summaryStyle: SummarizationStyle;
    createdAt: Date;
    updatedAt: Date;
}

interface IUserPreferenceModel extends Model<IUserPreference> {
}

const UserPreferenceSchema = new Schema<IUserPreference>({
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
    },
    preferredSources: {
        type: [String],
        required: true,
    },
    summaryStyle: {
        type: String,
        required: true,
        enum: SUMMARIZATION_STYLES,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    }
});

const UserPreferenceModel: IUserPreferenceModel = model<IUserPreference, IUserPreferenceModel>('UserPreference', UserPreferenceSchema);

export default UserPreferenceModel;
