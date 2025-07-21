import {Document, Model, model, Schema} from "mongoose";

export interface IBookmark extends Document {
    userExternalId: string;
    articleUrl: string;
    title: string;
    source: string;
    description?: string;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

interface IBookmarkModel extends Model<IBookmark> {
}

const BookmarkSchema = new Schema<IBookmark>({
    userExternalId: {
        type: String,
        required: true,
    },
    articleUrl: {
        type: String,
        required: true,
        trim: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    source: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: false,
        trim: true,
    },
    imageUrl: {
        type: String,
        required: false,
        trim: true,
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

BookmarkSchema.index({userExternalId: 1, articleUrl: 1}, {unique: true});   // users should not be able to bookmark same article more than once

const BookmarkModel: IBookmarkModel = model<IBookmark, IBookmarkModel>('Bookmark', BookmarkSchema);

export default BookmarkModel;
