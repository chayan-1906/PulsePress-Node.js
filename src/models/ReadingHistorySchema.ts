import {Document, Model, model, Schema} from "mongoose";
import generateNanoIdWithAlphabet from "../utils/generateUUID";

export interface IReadingHistory extends Document {
    readingHistoryId: string;
    readingHistoryExternalId: string;
    userExternalId: string;
    articleUrl: string;
    readAt: Date;
    readDuration?: number;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface IReadingHistoryModel extends Model<IReadingHistory> {
}

const ReadingHistorySchema = new Schema<IReadingHistory>({
    readingHistoryExternalId: {
        type: String,
        unique: true,
        required: true,
        default: () => generateNanoIdWithAlphabet(),
    },
    userExternalId: {
        type: String,
        required: true,
    },
    articleUrl: {
        type: String,
        required: true,
        trim: true,
    },
    readAt: {
        type: Date,
        required: true,
    },
    readDuration: {
        type: Number,
        required: false,
    },
    completed: {
        type: Boolean,
        required: false,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.readingHistoryId = String(ret._id);
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    }
});

ReadingHistorySchema.index({userExternalId: 1, readAt: -1});    // sorted in descending order

const ReadingHistoryModel: IReadingHistoryModel = model<IReadingHistory, IReadingHistoryModel>('ReadingHistory', ReadingHistorySchema);

export default ReadingHistoryModel;
