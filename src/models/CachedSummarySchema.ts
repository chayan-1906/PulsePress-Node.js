import {Document, Model, model, Schema} from "mongoose";
import {TIME_CONSTANTS} from "../utils/constants";
import {SUMMARIZATION_STYLES, SUPPORTED_LANGUAGES, TSummarizationStyle} from "../types/ai";

export interface ICachedSummary extends Document {
    contentHash: string;    // content + language + style
    summary: string;
    style: TSummarizationStyle;
    language: string;
    createdAt: Date;
    expiresAt: Date;
}

interface ICachedSummaryModel extends Model<ICachedSummary> {
}

const CachedSummarySchema = new Schema<ICachedSummary>({
    contentHash: {
        type: String,
        unique: true,
        required: true,
    },
    summary: {
        type: String,
        required: true,
        trim: true,
    },
    style: {
        type: String,
        required: true,
        default: 'standard',
        enum: SUMMARIZATION_STYLES,
    },
    language: {
        type: String,
        required: true,
        enum: SUPPORTED_LANGUAGES,
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: TIME_CONSTANTS.MONTH_IN_MS,    // 30 days - MongoDB TTL, MongoDB automatically deletes when expiresAt is reached
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    },
});

const CachedSummaryModel: ICachedSummaryModel = model<ICachedSummary, ICachedSummaryModel>('CachedSummary', CachedSummarySchema);

export default CachedSummaryModel;
