import {Request} from "express";
import {IUser} from "../models/UserSchema";

export const SUPPORTED_AUTH__PROVIDERS = ['email', 'google', 'magic-link'];
export type TSupportedAuthProvider = typeof SUPPORTED_AUTH__PROVIDERS[number];


export interface IAuthRequest extends Request {
    userExternalId: string;
    email: string;
}


/** ------------- API response types ------------- */

export interface IRegisterResponse {
    user?: object | null;
    error?: string;
}

export interface ILoginResponse {
    user?: object | null;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface IResetPasswordResponse {
    user?: object | null;
    error?: string;
}

export interface IGenerateMagicLinkResponse {
    success: boolean;
    message: string;
}

export interface IVerifyMagicLinkResponse {
    user?: IUser;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface ICheckAuthStatusResponse {
    authenticated?: boolean;
    user?: IUser;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

export interface IRefreshTokenResponse {
    accessToken?: string;
    error?: string;
}

export interface IUpdateUserResponse {
    user?: object | null;
    error?: string;
}

export interface IGenerateJWTResponse {
    accessToken?: string;
    refreshToken?: string;
}

export interface IGetUserByEmailResponse {
    user?: IUser | null;
    error?: string;
}

export interface IDeleteAccountByEmailResponse {
    isDeleted?: boolean;
    error?: string;
}


/** ------------- function params ------------- */

export interface IRegisterParams {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface ILoginParams {
    email: string;
    password: string;
}

export interface IResetPasswordParams {
    email: string;  // for authMiddleware
    currentPassword: string;
    newPassword: string;
}

export interface IRefreshTokenParams {
    refreshToken: string;
}

export interface ILoginWithGoogleParams {
    code: string;
}

export interface IGenerateMagicLinkParams {
    email: string;
}

export interface IVerifyMagicLinkParams {
    token: string;
}

export interface ICheckAuthStatusParams {
    email: string;
}

export interface IUpdateUserParams {
    email: string;  // for authMiddleware
    name?: string;
    password?: string;
    profilePicture?: string;
}

export interface IGetUserByEmailParams {
    email?: string | null;
}

export interface IDeleteAccountByEmailParams {
    email?: string | null;
}
