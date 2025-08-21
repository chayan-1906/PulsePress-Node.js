import mongoose from "mongoose";
import {getUserByEmail} from './AuthService';
import EmailService from './EmailService';
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
import {modifyUserPreference} from "./UserPreferenceService";
import generateNanoIdWithAlphabet from "../utils/generateUUID";
import AuthSessionModel, {IAuthSession} from "../models/AuthSessionSchema";
import {generateInvalidCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {CheckAuthStatusParams, CheckAuthStatusResponse, GenerateMagicLinkParams, GenerateMagicLinkResponse, VerifyMagicLinkParams, VerifyMagicLinkResponse} from "../types/auth";

const generateMagicLink = async ({email}: GenerateMagicLinkParams): Promise<GenerateMagicLinkResponse> => {
    try {
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
        console.log('random token in generateMagicLink:'.cyan.italic, token);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await MagicLinkModel.create({email, token, expiresAt});
        await EmailService.sendMagicLink(email, token);

        return {success: true, message: 'Magic link sent to your email'};
    } catch (error: any) {
        console.error('ERROR: inside catch of generateMagicLink:'.red.bold, error);
        throw error;
    }
}

const verifyMagicLink = async ({token}: VerifyMagicLinkParams): Promise<VerifyMagicLinkResponse> => {
    const magicLink = await MagicLinkModel.findOne({
        token,
        isUsed: false,
        expiresAt: {$gt: new Date()},
    });

    if (!magicLink) {
        return {error: generateInvalidCode('magic_link')};
    }

    const {user} = await getUserByEmail({email: magicLink.email});
    let finalUser: IUser;
    if (!user) {
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
            console.log('user created:'.cyan.italic, newUser);

            const {userPreference, error} = await modifyUserPreference({
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
                console.log('ERROR: creating user preference failed:'.yellow.italic, error);
                await session.abortTransaction();
                return {error: 'CREATE_USER_PREFERENCE_FAILED'};
            }
            console.log('user preference created:'.cyan.italic, userPreference);

            await session.commitTransaction();

            finalUser = newUser;
        } catch (error: any) {
            console.error('ERROR: inside catch of verifyMagicLink > userPreference:'.red.bold, error);
            await session.abortTransaction();
            throw error;
        } finally {
            await session.endSession();
        }
    } else {
        user.authProvider = 'magic-link';
        user.isVerified = true;
        await user.save();
        finalUser = user;
    }

    const {generateJWT} = await import('./AuthService');
    const {accessToken, refreshToken} = await generateJWT(finalUser);

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

    return {user: finalUser, accessToken, refreshToken};
}

// only for magicLink users -- not designed for google oauth and email/pass users
const checkAuthStatus = async ({email}: CheckAuthStatusParams): Promise<CheckAuthStatusResponse> => {
    try {
        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const session: IAuthSession | null = await AuthSessionModel.findOne({userExternalId: user.userExternalId});
        console.log('session from checkAuthStatus:'.cyan.italic, {session});
        if (session) {
            await AuthSessionModel.deleteOne({userExternalId: user.userExternalId});

            return {
                authenticated: true,
                user: session.user,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
            };
        }

        return {authenticated: false};
    } catch (error: any) {
        console.error('ERROR: inside catch of checkAuthStatus:'.red.bold, error);
        throw error;
    }
}

export {generateMagicLink, verifyMagicLink, checkAuthStatus};
