import "colors";
import bcryptjs from "bcryptjs";
import jwt, {SignOptions} from "jsonwebtoken";
import {AuthRequest} from "../types/auth";
import UserModel, {IUser} from "../models/UserSchema";
import {ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET} from "../config/config";

const registerUser = async (name: string, email: string, password: string, confirmPassword: string) => {
    try {
        const hashedPassword = await hashPassword(password);
        const isMatched = comparePassword(password, confirmPassword);
        if (!isMatched) {
            return;
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

const loginUser = async (email: string, password: string) => {
    try {
        if (!email) {
            throw new Error('Invalid email');
        } else if (!password) {
            throw new Error('Invalid password');
        }

        const user: IUser | null = await UserModel.findOne({email});
        if (!user) {
            throw new Error('No user found');
        }

        const isMatched = await verifyPassword(password, user.password!);
        if (!isMatched) {
            return;
        }

        const {accessToken, refreshToken} = await generateJWT(user);

        return {user, accessToken, refreshToken};
    } catch (error: any) {
        console.error('ERROR: inside catch of loginUser:'.red.bold, error);
        throw error;
    }
}

const hashPassword = async (password: string) => {
    try {
        const hashedPassword = await bcryptjs.hash(password, 10);
        console.log('hashPassword:'.cyan.italic, hashedPassword);
        return hashedPassword;
    } catch (error: any) {
        console.error('ERROR: inside catch of hashPassword:'.red.bold, error);
        throw error;
    }
}

const comparePassword = (password1: string, password2: string) => {
    try {
        const isMatched = password1 === password2;
        if (!isMatched) {
            throw new Error('Passwords don\'t match');
        }

        return isMatched;
    } catch (error: any) {
        console.error('ERROR: inside catch of comparePassword:'.red.bold, error);
        throw error;
    }
}

const verifyPassword = async (password: string, hashedPassword: string) => {
    try {
        const isMatched = await bcryptjs.compare(password, hashedPassword);
        if (!isMatched) {
            throw new Error('Invalid credentials');
        }

        return isMatched;
    } catch (error: any) {
        console.error('ERROR: inside catch of verifyPassword:'.red.bold, error);
        throw error;
    }
}

const generateJWT = async (user: IUser) => {
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

const refreshToken = async (rawRefreshToken: string) => {
    try {
        if (!rawRefreshToken) {
            throw new Error('Invalid refresh token');
        }

        const decoded = jwt.verify(rawRefreshToken, REFRESH_TOKEN_SECRET!) as AuthRequest;
        const user: IUser | null = await UserModel.findOne({userExternalId: decoded.userExternalId, refreshToken: rawRefreshToken}).select('+refreshToken');
        if (!user) {
            throw new Error('No user found');
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

export {registerUser, loginUser, hashPassword, comparePassword, refreshToken};
