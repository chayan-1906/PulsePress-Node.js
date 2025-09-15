import {Document, Model, model, Schema} from "mongoose";
import {TIME_CONSTANTS} from "../utils/constants";

export interface ICachedQuestionAnswer extends Document {
    contentHash: string;
    questions: string[];
    answers: Map<string, string>;
    createdAt: Date;
    expiresAt: Date;
}

interface ICachedQuestionAnswerModel extends Model<ICachedQuestionAnswer> {
}

const CachedQuestionAnswerSchema = new Schema<ICachedQuestionAnswer>({
    contentHash: {
        type: String,
        unique: true,
        required: true,
    },
    questions: {
        type: [String],
        required: true,
        default: [],
    },
    answers: {
        type: Map,
        of: String,
        required: true,
        default: new Map(),
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        // expires: TIME_CONSTANTS.WEEK_IN_MS,    // 7 days - MongoDB TTL, MongoDB automatically deletes when expiresAt is reached
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

const CachedQuestionAnswerModel: ICachedQuestionAnswerModel = model<ICachedQuestionAnswer, ICachedQuestionAnswerModel>('CachedQuestionAnswer', CachedQuestionAnswerSchema);

export default CachedQuestionAnswerModel;
