import {Document, Model, model, Schema} from "mongoose";
import {SUMMARIZATION_STYLES, SummarizationStyle, SUPPORTED_LANGUAGES} from "../types/ai";

export interface ICachedSummary extends Document {
    contentHash: string;    // content + language + style
    summary: string;
    style: SummarizationStyle;
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
        enum: SUMMARIZATION_STYLES,
    },
    language: {
        type: String,
        required: true,
        enum: SUPPORTED_LANGUAGES,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        index: {expireAfterSeconds: 0} // MongoDB TTL, MongoDB automatically deletes when expiresAt is reached
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

const CachedSummaryModel: ICachedSummaryModel = model<ICachedSummary, ICachedSummaryModel>('CachedSummary', CachedSummarySchema);

export default CachedSummaryModel;
