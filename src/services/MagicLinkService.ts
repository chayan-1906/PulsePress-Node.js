import "colors";
import mongoose from "mongoose";
import AuthService from './AuthService';
import EmailService from './EmailService';
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
import UserPreferenceService from "./UserPreferenceService";
import generateNanoIdWithAlphabet from "../utils/generateUUID";
import AuthSessionModel, {IAuthSession} from "../models/AuthSessionSchema";
import {generateInvalidCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ICheckAuthStatusParams, ICheckAuthStatusResponse, IGenerateMagicLinkParams, IGenerateMagicLinkResponse, IVerifyMagicLinkParams, IVerifyMagicLinkResponse} from "../types/auth";

class MagicLinkService {
    static async generateMagicLink({email}: IGenerateMagicLinkParams): Promise<IGenerateMagicLinkResponse> {
        console.log('Service: MagicLinkService.generateMagicLink called'.cyan.italic, {email});
        
        try {
            console.log('Database: Cleaning expired magic links'.cyan);
            await MagicLinkModel.deleteMany({
                email,
                $or: [
                    {
                        isUsed: true,
                    },
                    {
                        expiresAt: {
                            $lt: new Date(),
                        },
                    },
                ],
            });

            const token = generateNanoIdWithAlphabet();
            console.log('Magic link token generated'.cyan, {token: token.substring(0, 10) + '...'});
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            console.log('Database: Creating magic link record'.cyan);
            await MagicLinkModel.create({email, token, expiresAt});
            await EmailService.sendMagicLink(email, token);

            console.log('Magic link generation completed successfully'.green.bold);
            return {success: true, message: 'Magic link sent to your email'};
        } catch (error: any) {
            console.error('Service Error: MagicLinkService.generateMagicLink failed'.red.bold, error);
            throw error;
        }
    }

    static async verifyMagicLink({token}: IVerifyMagicLinkParams): Promise<IVerifyMagicLinkResponse> {
        console.log('Service: MagicLinkService.verifyMagicLink called'.cyan.italic, {token: token.substring(0, 10) + '...'});
        
        try {
            console.log('Database: Looking up magic link'.cyan);
            const magicLink = await MagicLinkModel.findOne({
                token,
                isUsed: false,
                expiresAt: {$gt: new Date()},
            });

            if (!magicLink) {
                console.warn('Client Error: Invalid or expired magic link'.yellow);
                return {error: generateInvalidCode('magic_link')};
            }

            console.log('Database: Magic link found and valid'.cyan, {email: magicLink.email});
            const {user} = await AuthService.getUserByEmail({email: magicLink.email});
            let finalUser: IUser;
            
            if (!user) {
                console.log('Database: Creating new user from magic link'.cyan);
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    const [newUser] = await UserModel.create([
                        {
                            name: magicLink.email.split('@')[0],
                            email: magicLink.email,
                            isVerified: true,
                            authProvider: 'magic-link',
                        },
                    ], {session});
                    console.log('Database: New user created'.cyan, newUser);

                    const {userPreference, error} = await UserPreferenceService.modifyUserPreference({
                        email: magicLink.email,
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

                    finalUser = newUser;
                } catch (error: any) {
                    console.error('Service Error: MagicLinkService.verifyMagicLink transaction failed'.red.bold, error);
                    await session.abortTransaction();
                    throw error;
                } finally {
                    await session.endSession();
                }
            } else {
                console.log('Database: Updating existing user for magic link auth'.cyan);
                user.authProvider = 'magic-link';
                user.isVerified = true;
                await user.save();
                finalUser = user;
            }

            console.log('Database: Generating JWT tokens'.cyan);
            const {accessToken, refreshToken} = await AuthService.generateJWT(finalUser);

            console.log('Database: Cleaning up magic link and creating auth session'.cyan);
            await Promise.all([
                magicLink.deleteOne(),
                AuthSessionModel.findOneAndUpdate(
                    {userExternalId: finalUser.userExternalId},
                    {
                        $set: {
                            userExternalId: finalUser.userExternalId,
                            email: finalUser.email,
                            accessToken, refreshToken,
                            user: finalUser,
                        },
                    },
                    {upsert: true, new: true},
                ),
            ]);

            console.log('Magic link verification completed successfully'.green.bold);
            return {user: finalUser, accessToken, refreshToken};
        } catch (error: any) {
            console.error('Service Error: MagicLinkService.verifyMagicLink failed'.red.bold, error);
            throw error;
        }
    }

    // only for magicLink users -- not designed for google oauth and email/pass users
    static async checkAuthStatus({email}: ICheckAuthStatusParams): Promise<ICheckAuthStatusResponse> {
        console.log('Service: MagicLinkService.checkAuthStatus called'.cyan.italic, {email});
        
        try {
            const {user} = await AuthService.getUserByEmail({email});
            if (!user) {
                console.warn('Client Error: User not found for auth status check'.yellow);
                return {error: generateNotFoundCode('user')};
            }

            console.log('Database: Looking up auth session'.cyan);
            const session: IAuthSession | null = await AuthSessionModel.findOne({userExternalId: user.userExternalId});
            console.log('Database: Auth session lookup result'.cyan, {found: !!session});
            
            if (session) {
                console.log('Database: Removing auth session after retrieval'.cyan);
                await AuthSessionModel.deleteOne({userExternalId: user.userExternalId});

                console.log('Auth status check completed successfully'.green.bold);
                return {
                    authenticated: true,
                    user: session.user,
                    accessToken: session.accessToken,
                    refreshToken: session.refreshToken,
                };
            }

            console.log('Auth status check completed successfully'.green.bold);
            return {authenticated: false};
        } catch (error: any) {
            console.error('Service Error: MagicLinkService.checkAuthStatus failed'.red.bold, error);
            throw error;
        }
    }
}

export default MagicLinkService;
