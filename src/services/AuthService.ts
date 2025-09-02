import "colors";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt, {SignOptions} from "jsonwebtoken";
import {getOAuth2Client} from "../utils/OAuth";
import MagicLinkService from "./MagicLinkService";
import BookmarkModel from "../models/BookmarkSchema";
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
import UserPreferenceService from "./UserPreferenceService";
import ReadingHistoryModel from "../models/ReadingHistorySchema";
import UserPreferenceModel from "../models/UserPreferenceSchema";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET} from "../config/config";
import {
    IAuthRequest,
    IDeleteAccountByEmailParams,
    IDeleteAccountByEmailResponse,
    IGenerateJWTResponse,
    IGetUserByEmailParams,
    IGetUserByEmailResponse,
    ILoginParams,
    ILoginResponse,
    ILoginWithGoogleParams,
    IRefreshTokenParams,
    IRefreshTokenResponse,
    IRegisterParams,
    IRegisterResponse,
    IResetPasswordParams,
    IResetPasswordResponse,
    IUpdateUserParams,
    IUpdateUserResponse
} from "../types/auth";

class AuthService {
    /**
     * Register new user with email and password validation
     */
    static async registerUser({name, email, password, confirmPassword}: IRegisterParams): Promise<IRegisterResponse> {
        console.log('Service: AuthService.registerUser called'.cyan.italic, {name, email});

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

            const hashedPassword = await this.hashPassword(password);
            const isMatched = this.comparePassword(password, confirmPassword);
            if (!isMatched) {
                return {error: 'PASSWORD_MISMATCH'};
            }

            const {user} = await this.getUserByEmail({email});
            if (user) {
                console.warn('Client Error: User already exists'.yellow);
                return {error: 'ALREADY_REGISTERED'};
            }

            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                const [newUser] = await UserModel.create([{name, email, password: hashedPassword, authProvider: 'email'}], {session});
                console.log('Database: User created'.cyan, newUser);

                const {userPreference, error} = await UserPreferenceService.modifyUserPreference({
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
                    console.error('Service Error: User preference creation failed'.red.bold, error);
                    await session.abortTransaction();
                    return {error: 'CREATE_USER_PREFERENCE_FAILED'};
                }
                console.log('Database: User preference created'.cyan, userPreference);

                await session.commitTransaction();

                await MagicLinkService.generateMagicLink({email});
                console.log('External API: Magic link sent'.magenta, {email});
                console.log('User registration completed successfully'.green.bold);
                return {user: newUser};
            } catch (error: any) {
                console.error('Service Error: AuthService.registerUser transaction failed'.red.bold, error);
                await session.abortTransaction();
                throw error;
            } finally {
                await session.endSession();
            }
        } catch (error: any) {
            console.error('Service Error: AuthService.registerUser failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Authenticate user with email and password credentials
     */
    static async loginUser({email, password}: ILoginParams): Promise<ILoginResponse> {
        console.log('Service: AuthService.loginUser called'.cyan.italic, {email});

        try {
            if (!password) {
                return {error: generateMissingCode('password')};
            }

            const {user} = await this.getUserByEmail({email});

            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            if (!user.isVerified) {
                return {error: 'USER_NOT_VERIFIED'};
            }

            if (!user.password) {
                if (user.authProvider === 'google') {
                    return {error: 'GOOGLE_OAUTH_USER'};
                }
                if (user.authProvider === 'magic-link') {
                    return {error: 'MAGIC_LINK_USER'};
                }
            }

            const isMatched = await this.verifyPassword(password, user.password!);
            if (!isMatched) {
                return {error: generateInvalidCode('credentials')};
            }

            const {accessToken, refreshToken} = await this.generateJWT(user);

            console.log('User login completed successfully'.green.bold);
            return {user, accessToken, refreshToken};
        } catch (error: any) {
            console.error('Service Error: AuthService.loginUser failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Reset user password with current password verification
     */
    static async resetPassword({email, currentPassword, newPassword}: IResetPasswordParams): Promise<IResetPasswordResponse> {
        console.log('Service: AuthService.resetPassword called'.cyan.italic, {email});

        try {
            const {user} = await this.getUserByEmail({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            if (!user.password) {
                return {error: 'NO_PASSWORD_SET'};
            }

            if (!currentPassword) {
                return {error: generateMissingCode('current_password')};
            }

            if (!newPassword) {
                return {error: generateMissingCode('new_password')};
            }

            const isMatched = await this.verifyPassword(currentPassword, user.password!);
            if (!isMatched) {
                return {error: generateInvalidCode('credentials')};
            }

            if (currentPassword === newPassword) {
                return {error: 'SAME_PASSWORD'};
            }

            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{6,})/.test(newPassword)) {
                return {error: generateInvalidCode('new_password')};
            }
            user.password = await this.hashPassword(newPassword);
            await user.save();
            console.log('Database: Password updated'.cyan);

            console.log('Password reset completed successfully'.green.bold);
            return {user};
        } catch (error: any) {
            console.error('Service Error: AuthService.resetPassword failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Generate new access token using valid refresh token
     */
    static async refreshToken({refreshToken: rawRefreshToken}: IRefreshTokenParams): Promise<IRefreshTokenResponse> {
        console.log('Service: AuthService.refreshToken called'.cyan.italic);

        try {
            if (!rawRefreshToken) {
                return {error: generateMissingCode('refreshToken')};
            }

            const decoded = jwt.verify(rawRefreshToken, REFRESH_TOKEN_SECRET!) as IAuthRequest;
            const user: IUser | null = await UserModel.findOne({userExternalId: decoded.userExternalId, refreshToken: rawRefreshToken}).select('+refreshToken');
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            const newAccessToken = jwt.sign(
                {userExternalId: user.userExternalId, email: user.email},
                ACCESS_TOKEN_SECRET!,
                {expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn']},
            );

            console.log('Token refresh completed successfully'.green.bold);
            return {accessToken: newAccessToken};
        } catch (error: any) {
            console.error('Service Error: AuthService.refreshToken failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Authenticate or register user using Google OAuth2
     */
    static async loginWithGoogle({code}: ILoginWithGoogleParams): Promise<ILoginResponse> {
        console.log('Service: AuthService.loginWithGoogle called'.cyan.italic);

        try {
            if (!code) {
                return {error: generateInvalidCode('code')};
            }

            console.log('External API: Getting OAuth2 client'.magenta);
            const oauth2Client = await getOAuth2Client();

            console.log('External API: Exchanging code for tokens'.magenta);
            const {tokens} = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);

            const {google} = await import('googleapis');
            const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
            console.log('External API: Getting user info from Google'.magenta);
            const userInfoResponse = await oauth2.userinfo.get();

            const {id: googleId, name, email, picture: profilePicture} = userInfoResponse.data;

            const {user} = await this.getUserByEmail({email});
            if (user) {
                console.log('Database: Existing user found'.cyan);
                user.authProvider = 'google';
                user.isVerified = true;
                user.googleId = googleId || '';
                await user.save();
                const {accessToken, refreshToken} = await this.generateJWT(user);
                console.log('Google login completed successfully'.green.bold);
                return {user, accessToken, refreshToken};
            }

            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                if (!email) {
                    await session.abortTransaction();
                    return {error: generateInvalidCode('email')};
                }

                const [newUser] = await UserModel.create([{googleId, name, email, profilePicture, isVerified: true, authProvider: 'google'}], {session});

                const {accessToken, refreshToken} = await this.generateJWT(newUser);
                console.log('Database: New user created'.cyan, newUser);

                const {userPreference, error} = await UserPreferenceService.modifyUserPreference({
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
                    console.error('Service Error: User preference creation failed'.red.bold, error);
                    await session.abortTransaction();
                    return {error: 'CREATE_USER_PREFERENCE_FAILED'};
                }
                console.log('Database: User preference created'.cyan, userPreference);

                await session.commitTransaction();
                console.log('Google registration completed successfully'.green.bold);
                return {user: newUser, accessToken, refreshToken};
            } catch (error: any) {
                console.error('Service Error: AuthService.loginWithGoogle transaction failed'.red.bold, error);
                await session.abortTransaction();
                throw error;
            } finally {
                await session.endSession();
            }
        } catch (error: any) {
            console.error('Service Error: AuthService.loginWithGoogle failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Update user profile information including name, password, and profile picture
     */
    static async updateUser({email, name, password, profilePicture}: IUpdateUserParams): Promise<IUpdateUserResponse> {
        console.log('Service: AuthService.updateUser called'.cyan.italic, {email, name});

        try {
            const {user} = await this.getUserByEmail({email});
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
                user.password = await this.hashPassword(password);
            }

            user.profilePicture = profilePicture;   // user can remove profile picture
            const updatedUser: IUser | null = await user.save();
            if (!user) {
                return {error: 'UPDATE_USER_FAILED'};
            }
            console.log('Database: User updated'.cyan, {user: updatedUser});
            console.log('User update completed successfully'.green.bold);
            return {user: updatedUser};
        } catch (error: any) {
            console.error('Service Error: AuthService.updateUser failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Hash password using bcrypt with salt rounds
     */
    private static async hashPassword(password: string): Promise<string> {
        console.log('Service: AuthService.hashPassword called'.cyan.italic, password);

        try {
            const hashedPassword = await bcryptjs.hash(password, 10);
            console.log('Password hashed'.cyan, hashedPassword);
            return hashedPassword;
        } catch (error: any) {
            console.error('Service Error: AuthService.hashPassword failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Compare two plain text passwords for equality
     */
    private static comparePassword(password1: string, password2: string): boolean {
        console.log('Service: AuthService.comparePassword called'.cyan.italic, {password1, password2});

        try {
            const isMatched = password1 === password2;
            if (!isMatched) {
                // throw new Error('Passwords don\'t match');
                return false;
            }

            return isMatched;
        } catch (error: any) {
            console.error('Service Error: AuthService.comparePassword failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Verify plain text password against bcrypt hash
     */
    private static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        console.log('Service: AuthService.verifyPassword called'.cyan.italic, {password, hashedPassword});

        try {
            const isMatched = await bcryptjs.compare(password, hashedPassword);
            if (!isMatched) {
                // throw new Error('Invalid credentials');
                return false;
            }

            return isMatched;
        } catch (error: any) {
            console.error('Service Error: AuthService.verifyPassword failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Generate JWT access and refresh tokens for user
     */
    static async generateJWT(user: IUser): Promise<IGenerateJWTResponse> {
        console.log('Service: AuthService.generateJWT called'.cyan.italic, {user});

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

            console.log('JWT tokens generated'.cyan, {accessToken, refreshToken})
            return {accessToken, refreshToken};
        } catch (error: any) {
            console.error('Service Error: AuthService.generateJWT failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Retrieve user by email address
     */
    static async getUserByEmail({email}: IGetUserByEmailParams): Promise<IGetUserByEmailResponse> {
        console.log('Service: AuthService.getUserByEmail called'.cyan.italic, {email});

        try {
            if (!email) {
                return {error: generateMissingCode('email')};
            }

            const user: IUser | null = await UserModel.findOne({email});
            if (!user) {
                return {error: generateNotFoundCode('user')};
            }

            console.log('Database: User found'.cyan);
            console.log('User retrieval completed successfully'.green.bold);
            return {user};
        } catch (error: any) {
            console.error('Service Error: AuthService.getUserByEmail failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Delete user account and all associated data using transaction
     */
    static async deleteAccount({email}: IDeleteAccountByEmailParams): Promise<IDeleteAccountByEmailResponse> {
        console.log('Service: AuthService.deleteAccount called'.cyan.italic, {email});

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
            console.log('Database: Deleting user related data'.cyan);
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
            console.log('Account deletion completed successfully'.green.bold);
            return {isDeleted: true};
        } catch (error: any) {
            console.error('Service Error: AuthService.deleteAccount failed'.red.bold, error);
            await session.abortTransaction();   // ❌ Something failed - UNDO everything
            throw error;
        } finally {
            await session.endSession();         // Clean up the session
        }
    }
}

export default AuthService;
