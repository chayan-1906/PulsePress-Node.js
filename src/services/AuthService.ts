import "colors";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt, {SignOptions} from "jsonwebtoken";
import {getOAuth2Client} from "../utils/OAuth";
import {generateMagicLink} from "./MagicLinkService";
import BookmarkModel from "../models/BookmarkSchema";
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
import {modifyUserPreference} from "./UserPreferenceService";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET} from "../config/config";
import {
    AuthRequest,
    DeleteAccountByEmailParams,
    DeleteAccountByEmailResponse,
    GenerateJWTResponse,
    GetUserByEmailParams,
    GetUserByEmailResponse,
    LoginParams,
    LoginResponse,
    LoginWithGoogleParams,
    RefreshTokenParams,
    RefreshTokenResponse,
    RegisterParams,
    RegisterResponse,
    UpdateUserParams,
    UpdateUserResponse
} from "../types/auth";

const registerUser = async ({name, email, password, confirmPassword}: RegisterParams): Promise<RegisterResponse> => {
    try {
        if (!name) {
            return {error: generateMissingCode('name')};
        }
        if (!password) {
            return {error: generateMissingCode('password')};
        }
        if (!confirmPassword) {
            return {error: generateMissingCode('confirm_password')};
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/.test(password)) {
            return {error: generateInvalidCode('password')};
        }

        const hashedPassword = await hashPassword(password);
        const isMatched = comparePassword(password, confirmPassword);
        if (!isMatched) {
            return {error: 'PASSWORD_MISMATCH'};
        }

        const {user} = await getUserByEmail({email});
        if (user) {
            console.info('user exists'.bgMagenta.white.italic);
            return {error: 'ALREADY_REGISTERED'};
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const [newUser] = await UserModel.create([{name, email, password: hashedPassword}], {session});
            console.log('user created:'.cyan.italic, newUser);

            const {userPreference, error} = await modifyUserPreference({
                email,
                user: newUser,
                preferredLanguage: 'en',
                preferredCategories: [],
                preferredSources: [],
                summaryStyle: 'standard',
                newsLanguages: ['english'],
                session,
            });
            if (error) {
                console.log('ERROR: creating user preference failed:'.yellow.italic, error);
                await session.abortTransaction();
                return {error: 'CREATE_USER_PREFERENCE_FAILED'};
            }
            console.log('user preference created:'.cyan.italic, userPreference);

            await session.commitTransaction();

            await generateMagicLink({email});
            console.log('verification magic link sent:'.cyan.italic, {email});
            return {user: newUser};
        } catch (error: any) {
            console.error('ERROR: inside catch of registerUser > userPreference:'.red.bold, error);
            await session.abortTransaction();
            throw error;
        } finally {
            await session.endSession();
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of registerUser:'.red.bold, error);
        throw error;
    }
}

const loginUser = async ({email, password}: LoginParams): Promise<LoginResponse> => {
    try {
        if (!password) {
            return {error: generateMissingCode('password')};
        }

        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }
        if (!user.isMagicLoginVerified && !user.googleId) {
            return {error: 'USER_NOT_VERIFIED'};
        }

        if (user.googleId && !user.password) {
            return {error: 'GOOGLE_USER_USE_OAUTH'};
        }

        const isMatched = await verifyPassword(password, user.password!);
        if (!isMatched) {
            return {error: generateInvalidCode('credentials')};
        }

        const {accessToken, refreshToken} = await generateJWT(user);

        return {user, accessToken, refreshToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of loginUser:'.red.bold, error);
        throw error;
    }
}

const refreshToken = async ({refreshToken: rawRefreshToken}: RefreshTokenParams): Promise<RefreshTokenResponse> => {
    try {
        if (!rawRefreshToken) {
            return {error: generateMissingCode('refreshToken')};
        }

        const decoded = jwt.verify(rawRefreshToken, REFRESH_TOKEN_SECRET!) as AuthRequest;
        const user: IUser | null = await UserModel.findOne({userExternalId: decoded.userExternalId, refreshToken: rawRefreshToken}).select('+refreshToken');
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const newAccessToken = jwt.sign(
            {userExternalId: user.userExternalId},
            ACCESS_TOKEN_SECRET!,
            {expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn']}
        );

        return {accessToken: newAccessToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of refreshToken:'.red.bold, error);
        throw error;
    }
}

const loginWithGoogle = async ({code}: LoginWithGoogleParams): Promise<LoginResponse> => {
    try {
        if (!code) {
            return {error: generateInvalidCode('code')};
        }

        const oauth2Client = await getOAuth2Client();

        const {tokens} = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const {google} = await import('googleapis');
        const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
        const userInfoResponse = await oauth2.userinfo.get();

        const {id: googleId, name, email, picture: profilePicture} = userInfoResponse.data;

        const {user} = await getUserByEmail({email});
        if (user) {
            console.info('user exists'.bgMagenta.white.italic);
            const {accessToken, refreshToken} = await generateJWT(user);
            return {user, accessToken, refreshToken};
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const [newUser] = await UserModel.create([{googleId, name, email, profilePicture, isMagicLoginVerified: true}], {session});
            const {accessToken, refreshToken} = await generateJWT(newUser);
            console.log('user created:'.cyan.italic, newUser);

            const {userPreference, error} = await modifyUserPreference({
                email: email || '',
                user: newUser,
                preferredLanguage: 'en',
                preferredCategories: [],
                preferredSources: [],
                summaryStyle: 'standard',
                newsLanguages: ['english'],
                session,
            });
            if (error) {
                console.log('ERROR: creating user preference failed:'.yellow.italic, error);
                await session.abortTransaction();
                return {error: 'CREATE_USER_PREFERENCE_FAILED'};
            }
            console.log('user preference created:'.cyan.italic, userPreference);

            await session.commitTransaction();
            return {user: newUser, accessToken, refreshToken};
        } catch (error: any) {
            console.error('ERROR: inside catch of loginWithGoogle > userPreference:'.red.bold, error);
            await session.abortTransaction();
            throw error;
        } finally {
            await session.endSession();
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of loginWithGoogle:'.red.bold, error);
        throw error;
    }
}

const updateUser = async ({email, name, password, profilePicture}: UpdateUserParams): Promise<UpdateUserResponse> => {
    try {
        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        if (name) {
            user.name = name;
        }
        if (password) {
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/.test(password)) {
                return {error: generateInvalidCode('password')};
            }
            user.password = await hashPassword(password);
        }
        user.profilePicture = profilePicture;   // user can remove profile picture
        const updatedUser: IUser | null = await user.save();
        if (!user) {
            return {error: 'UPDATE_USER_FAILED'};
        }
        console.log('user updated:', {user: updatedUser});
        return {user: updatedUser};
    } catch (error: any) {
        console.error('ERROR: inside catch of updateUser:'.red.bold, error);
        throw error;
    }
}

const hashPassword = async (password: string): Promise<string> => {
    try {
        const hashedPassword = await bcryptjs.hash(password, 10);
        console.info('hashPassword:'.bgMagenta.white.italic, hashedPassword);
        return hashedPassword;
    } catch (error: any) {
        console.error('ERROR: inside catch of hashPassword:'.red.bold, error);
        throw error;
    }
}

const comparePassword = (password1: string, password2: string): boolean => {
    try {
        const isMatched = password1 === password2;
        if (!isMatched) {
            // throw new Error('Passwords don\'t match');
            return false;
        }

        return isMatched;
    } catch (error: any) {
        console.error('ERROR: inside catch of comparePassword:'.red.bold, error);
        throw error;
    }
}

const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    try {
        const isMatched = await bcryptjs.compare(password, hashedPassword);
        if (!isMatched) {
            // throw new Error('Invalid credentials');
            return false;
        }

        return isMatched;
    } catch (error: any) {
        console.error('ERROR: inside catch of verifyPassword:'.red.bold, error);
        throw error;
    }
}

const generateJWT = async (user: IUser): Promise<GenerateJWTResponse> => {
    try {
        const accessToken = jwt.sign(
            {userExternalId: user.userExternalId, email: user.email},
            ACCESS_TOKEN_SECRET!,
            {expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn']},
        );

        const refreshToken = jwt.sign(
            {userExternalId: user.userExternalId, email: user.email},
            REFRESH_TOKEN_SECRET!,
            {expiresIn: REFRESH_TOKEN_EXPIRY as SignOptions['expiresIn']},
        );

        await UserModel.findOneAndUpdate(
            {userExternalId: user.userExternalId},
            {refreshToken},
        );

        console.log('generateJWT:'.cyan.italic, {accessToken, refreshToken})
        return {accessToken, refreshToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of generateJWT:'.red.bold, error);
        throw error;
    }
}

const getUserByEmail = async ({email}: GetUserByEmailParams): Promise<GetUserByEmailResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }
        const user: IUser | null = await UserModel.findOne({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        console.log('userByEmail:'.cyan.italic, {user})
        return {user};
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserByEmail:'.red.bold, error);
        throw error;
    }
}

const deleteAccount = async ({email}: DeleteAccountByEmailParams): Promise<DeleteAccountByEmailResponse> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }
        const user: IUser | null = await UserModel.findOne({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        // Delete in dependency order
        await MagicLinkModel.deleteMany({email}, {session});
        await ReadingHistoryModel.deleteMany({userExternalId: user.userExternalId}, {session});
        await BookmarkModel.deleteMany({userExternalId: user.userExternalId}, {session});
        await UserPreferenceModel.deleteMany({userExternalId: user.userExternalId}, {session});
        const {deletedCount} = await UserModel.deleteOne({userExternalId: user.userExternalId}, {session});

        if (deletedCount === 0) {
            await session.abortTransaction();
            return {error: 'DELETE_ACCOUNT_FAILED'};
        }

        await session.commitTransaction();  // ✅ ALL operations succeeded - save changes
        return {isDeleted: true};
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserByEmail:'.red.bold, error);
        await session.abortTransaction();   // ❌ Something failed - UNDO everything
        throw error;
    } finally {
        await session.endSession();               // Clean up the session
    }
}

export {registerUser, loginUser, refreshToken, loginWithGoogle, updateUser, hashPassword, comparePassword, generateJWT, getUserByEmail, deleteAccount};
