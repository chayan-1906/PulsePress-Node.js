import {Request} from "express";
import {IUser} from "../models/UserSchema";

export const SUPPORTED_AUTH__PROVIDERS = ['email', 'google', 'magic-link'];
export type SupportedAuthProvider = typeof SUPPORTED_AUTH__PROVIDERS[number];


export interface AuthRequest extends Request {
    userExternalId: string;
    email: string;
}


/** ------------- API response types ------------- */

export interface RegisterResponse {
    user?: object | null;
    error?: string;
}

export interface LoginResponse {
    user?: object | null;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface ResetPasswordResponse {
    user?: object | null;
    error?: string;
}

export interface GenerateMagicLinkResponse {
    success: boolean;
    message: string;
}

export interface VerifyMagicLinkResponse {
    user?: IUser;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface CheckAuthStatusResponse {
    authenticated?: boolean;
    user?: IUser;
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

export interface ResetPasswordParams {
    email: string;
    currentPassword: string;
    newPassword: string;
}

export interface RefreshTokenParams {
    refreshToken: string;
}

export interface LoginWithGoogleParams {
    code: string;
}

export interface GenerateMagicLinkParams {
    email: string;
}

export interface VerifyMagicLinkParams {
    token: string;
}

export interface CheckAuthStatusParams {
    email: string;
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
