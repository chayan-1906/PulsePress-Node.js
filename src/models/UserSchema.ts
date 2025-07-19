import {Document, Model, model, Schema} from "mongoose";
import generateNanoIdWithAlphabet from "../utils/generateUUID";

export interface IUser extends Document {
    userId: string;
    userExternalId: string;
    googleId?: string;
    name?: string;
    email?: string;
    password?: string;
    profilePicture?: string;
    refreshToken?: string;
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
        validate: {
            validator: function (password: string) {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/.test(password);
            },
            message: 'Password must contain lowercase, uppercase, special character, minimum 6 characters'
        },
        required: true,
        trim: true,
    },
    profilePicture: {
        type: String,
        trim: true,
    },
    refreshToken: {
        type: String,
        select: false  // Don't return in queries
    }
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            delete ret.password;

            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    },
});

const UserModel: IUserModel = model<IUser, IUserModel>('User', UserSchema);

export default UserModel;
