import {v4 as uuidv4} from 'uuid';
import {getUserByEmail} from './AuthService';
import {sendMagicLink} from './EmailService';
import UserModel, {IUser} from "../models/UserSchema";
import MagicLinkModel from "../models/MagicLinkSchema";
import {generateInvalidCode} from "../utils/generateErrorCodes";
import {GenerateMagicLinkParams, VerifyMagicLinkParams} from "../types/auth";

export const generateMagicLink = async ({email}: GenerateMagicLinkParams) => {
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
}

export const verifyMagicLink = async ({token}: VerifyMagicLinkParams) => {
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

    await magicLink.deleteOne();

    return {user: finalUser, accessToken, refreshToken};
}
