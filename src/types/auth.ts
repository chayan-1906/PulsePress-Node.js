import {Request} from "express";
import {IUser} from "../models/UserSchema";

export interface AuthRequest extends Request {
    userExternalId: string;
    email: string;
}


/** ------------- API response types ------------- */

export interface RegisterResponse {
    user?: object | null;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface LoginResponse {
    user?: object | null;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface RefreshTokenResponse {
    accessToken?: string;
    error?: string;
}

export interface UpdateUserResponse {
    user?: object | null;
    error?: string;
}

export interface GenerateJWTResponse {
    accessToken?: string;
    refreshToken?: string;
}

export interface GetUserByEmailResponse {
    user?: IUser | null;
    error?: string;
}

export interface DeleteAccountByEmailResponse {
    isDeleted?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface RegisterParams {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface LoginParams {
    email: string;
    password: string;
}

export interface RefreshTokenParams {
    refreshToken: string;
}

export interface LoginWithGoogleParams {
    code: string;
}

export interface UpdateUserParams {
    email: string;
    name?: string;
    password?: string;
    profilePicture?: string;
}

export interface GetUserByEmailParams {
    email?: string | null;
}

export interface DeleteAccountByEmailParams {
    email?: string | null;
}
