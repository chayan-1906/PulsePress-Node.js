import {Document, Model, model, Schema} from "mongoose";
import {IUser} from "./UserSchema";

export interface IAuthSession extends Document {
    userExternalId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    user?: IUser;
    createdAt: Date;
    updatedAt: Date;
}

interface IAuthSessionModel extends Model<IAuthSession> {
}

const AuthSessionSchema = new Schema<IAuthSession>({
    userExternalId: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
    },
    accessToken: {
        type: String,
        required: true,
        trim: true,
    },
    refreshToken: {
        type: String,
        required: true,
        trim: true,
    },
    user: {
        type: Object,
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 20 * 60,   // 20 minutes TTL, users might log in right after 15 m of getting the magic link
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

const AuthSessionModel: IAuthSessionModel = model<IAuthSession, IAuthSessionModel>('AuthSession', AuthSessionSchema);

export default AuthSessionModel;
