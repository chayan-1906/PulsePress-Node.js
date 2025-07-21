import {Document, Model, model, Schema} from "mongoose";

export interface IReadingHistory extends Document {
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
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    }
});

ReadingHistorySchema.index({userExternalId: 1, readAt: -1});    // sorted in descending order

const ReadingHistoryModel: IReadingHistoryModel = model<IReadingHistory, IReadingHistoryModel>('ReadingHistory', ReadingHistorySchema);

export default ReadingHistoryModel;
