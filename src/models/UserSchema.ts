import {Document, Model, model, Schema} from "mongoose";
import {USER_STRIKE_BLOCK, UserStrikeBlock} from "../types/ai";
import generateNanoIdWithAlphabet from "../utils/generateUUID";

export interface IUserStrike {
    count: number;
    lastStrikeAt?: Date;
    blockedUntil?: Date;
    blockType?: UserStrikeBlock; // 15-30min vs 2-day block
}

export interface IUser extends Document {
    userId: string;
    userExternalId: string;
    googleId?: string;
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
    }
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
            return !this.googleId;
        }, // Only required if not Google user
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
