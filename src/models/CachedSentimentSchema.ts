import {Document, Model, model, Schema} from "mongoose";
import {SENTIMENT_TYPES, SentimentResult} from "../types/ai";

export interface ICachedSentiment extends Document {
    contentHash: string;
    sentiment: SentimentResult;
    confidence: number;
    createdAt: Date;
    expiresAt: Date;
}

interface ICachedSentimentModel extends Model<ICachedSentiment> {
}

const CachedSentimentSchema = new Schema<ICachedSentiment>({
    contentHash: {
        type: String,
        unique: true,
        required: true,
    },
    sentiment: {
        type: String,
        required: true,
        enum: SENTIMENT_TYPES,
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        index: {expireAfterSeconds: 0},
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

const CachedSentimentModel: ICachedSentimentModel = model<ICachedSentiment, ICachedSentimentModel>('CachedSentiment', CachedSentimentSchema);

export default CachedSentimentModel;
