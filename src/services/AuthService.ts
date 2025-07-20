import "colors";
import bcryptjs from "bcryptjs";
import jwt, {SignOptions} from "jsonwebtoken";
import {getOAuth2Client} from "../utils/OAuth";
import UserModel, {IUser} from "../models/UserSchema";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET} from "../config/config";
import {
    AuthRequest,
    GenerateJWTResponse,
    GetUserByEmailParams,
    LoginParams,
    LoginResponse,
    LoginWithGoogleParams,
    RefreshTokenParams,
    RefreshTokenResponse,
    RegisterParams,
    RegisterResponse
} from "../types/auth";

const registerUser = async ({name, email, password, confirmPassword}: RegisterParams): Promise<RegisterResponse> => {
    try {
        if (!name) {
            return {error: generateMissingCode('name')};
        }
        if (!email) {
            return {error: generateMissingCode('email')};
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

        const user: IUser | null = await getUserByEmail({email});
        if (user) {
            console.info('user exists'.bgMagenta.white.italic);
            return {error: 'ALREADY_REGISTERED'};
        }

        const newUser: IUser | null = await UserModel.create({name, email, password: hashedPassword});
        const {accessToken, refreshToken} = await generateJWT(newUser);

        console.log('user created:'.cyan.italic, newUser);
        return {user: newUser, accessToken, refreshToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of registerUser:'.red.bold, error);
        throw error;
    }
}

const loginUser = async ({email, password}: LoginParams): Promise<LoginResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }
        if (!password) {
            return {error: generateMissingCode('password')};
        }

        const user: IUser | null = await UserModel.findOne({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
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
        if (!email) {
            return {error: generateInvalidCode('email_address')};
        }

        const user: IUser | null = await getUserByEmail({email});
        if (user) {
            console.info('user exists'.bgMagenta.white.italic);
            const {accessToken, refreshToken} = await generateJWT(user);
            return {user, accessToken, refreshToken};
        }

        const newUser: IUser | null = await UserModel.create({googleId, name, email, profilePicture});
        const {accessToken, refreshToken} = await generateJWT(newUser);

        return {user: newUser, accessToken, refreshToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of loginWithGoogle:'.red.bold, error);
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
            {userExternalId: user.userExternalId},
            ACCESS_TOKEN_SECRET!,
            {expiresIn: ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn']},
        );

        const refreshToken = jwt.sign(
            {userExternalId: user.userExternalId},
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

const getUserByEmail = async ({email}: GetUserByEmailParams): Promise<IUser | null> => {
    try {
        const user: IUser | null = await UserModel.findOne({email});
        console.log('userByEmail:'.cyan.italic, {user})
        return user;
    } catch (error: any) {
        console.error('ERROR: inside catch of getUserByEmail:'.red.bold, error);
        throw error;
    }
}

export {registerUser, loginUser, refreshToken, loginWithGoogle, hashPassword, comparePassword, getUserByEmail};
