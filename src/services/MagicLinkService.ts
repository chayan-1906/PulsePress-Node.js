import {v4 as uuidv4} from 'uuid';
import {getUserByEmail} from './AuthService';
import {sendMagicLink} from './EmailService';
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
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

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await MagicLinkModel.create({email, token, expiresAt});
        await sendMagicLink(email, token);

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
        const newUser = await UserModel.create({
            name: magicLink.email.split('@')[0],
            email: magicLink.email,
            isMagicLoginVerified: true,
            // No password field for magic link users
        });

        finalUser = newUser;
    } else {
        user.isMagicLoginVerified = true;
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
