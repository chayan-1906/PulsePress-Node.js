import {v4 as uuidv4} from 'uuid';
import {Document, model, Model, Schema} from "mongoose";

export interface IMagicLink extends Document {
    email: string;
    token: string;
    expiresAt: Date;
    isUsed: boolean;
    createdAt: Date;
}

interface IMagicLinkModel extends Model<IMagicLink> {
}

const MagicLinkSchema = new Schema<IMagicLink>({
    email: {
        type: String,
        required: true,
        lowercase: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
        default: uuidv4,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    isUsed: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
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

const MagicLinkModel: IMagicLinkModel = model<IMagicLink, IMagicLinkModel>('MagicLink', MagicLinkSchema);

export default MagicLinkModel;
