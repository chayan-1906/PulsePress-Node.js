import {Document, Model, model, Schema} from "mongoose";
import generateNanoIdWithAlphabet from "../utils/generateUUID";
import {SUPPORTED_AUTH__PROVIDERS, TSupportedAuthProvider} from "../types/auth";
import {IStrikeHistoryEvent, USER_STRIKE_BLOCK, TUserStrikeBlock} from "../types/ai";

export interface IUserStrike {
    count: number;
    lastStrikeAt?: Date;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock; // 15-30min vs 2-day block
    history: IStrikeHistoryEvent[];
}

const StrikeHistoryEventSchema = new Schema<IStrikeHistoryEvent>({
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

export interface IUser extends Document {
    userId: string;
    userExternalId: string;
    authProvider: TSupportedAuthProvider;
    googleId?: string;
    isVerified: boolean;
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

const UserSchema = new Schema<IUser>({
    userExternalId: {
        type: String,
        unique: true,
        required: true,
        default: () => generateNanoIdWithAlphabet(),
    },
    authProvider: {
        type: String,
        required: true,
        enum: SUPPORTED_AUTH__PROVIDERS,
    },
    googleId: {
        type: String,
    },
    isVerified: {
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
            // return !this.googleId && !this.isVerified;
            return this.authProvider === 'email';
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
