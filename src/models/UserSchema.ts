import {Document, Model, model, Schema} from "mongoose";
import generateNanoIdWithAlphabet from "../utils/generateUUID";
import {StrikeHistoryEvent, USER_STRIKE_BLOCK, UserStrikeBlock} from "../types/ai";

export interface IUserStrike {
    count: number;
    lastStrikeAt?: Date;
    blockedUntil?: Date;
    blockType?: UserStrikeBlock; // 15-30min vs 2-day block
    history: StrikeHistoryEvent[];
}

export interface IUser extends Document {
    userId: string;
    userExternalId: string;
    googleId?: string;
    isMagicLoginVerified: boolean;
    name?: string;
    email?: string;
    password?: string;
    profilePicture?: string;
    refreshToken?: string;
    newsClassificationStrikes?: IUserStrike;
    createdAt: Date;
    updatedAt: Date;
}

interface IUserModel extends Model<IUser> {
}

const StrikeHistoryEventSchema = new Schema<StrikeHistoryEvent>({
    strikeNumber: {
        type: Number,
        required: true,
        min: 1,
    },
    appliedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    reason: {
        type: String,
        required: true,
    },
    blockType: {
        type: String,
        enum: USER_STRIKE_BLOCK,
    },
    blockDuration: {
        type: String,
    },
}, {_id: false});

const UserStrikeSchema = new Schema<IUserStrike>({
    count: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastStrikeAt: {
        type: Date,
    },
    blockedUntil: {
        type: Date,
    },
    blockType: {
        type: String,
        enum: USER_STRIKE_BLOCK,
    },
    history: {
        type: [StrikeHistoryEventSchema],
        default: [],
    },
}, {_id: false});

const UserSchema = new Schema<IUser>({
    userExternalId: {
        type: String,
        unique: true,
        required: true,
        default: () => generateNanoIdWithAlphabet(),
    },
    googleId: {
        type: String,
    },
    isMagicLoginVerified: {
        type: Boolean,
        default: false,
    },
    name: {
        type: String,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required() {
            return !this.googleId && !this.isMagicLoginVerified;
        }, // Only required for Email/Password auth
        trim: true,
    },
    profilePicture: {
        type: String,
        trim: true,
    },
    refreshToken: {
        type: String,
        select: false  // Don't return in queries
    },
    newsClassificationStrikes: {
        type: UserStrikeSchema,
        default: () => ({
            count: 0,
            history: [],
        }),
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.userId = String(ret._id);
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;
            (ret as any).password = undefined;

            return ret;
        },
    }
});

const UserModel: IUserModel = model<IUser, IUserModel>('User', UserSchema);

export default UserModel;
