import {Request} from "express";

export interface AuthRequest extends Request {
    userExternalId: string;
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

export interface GenerateJWTResponse {
    accessToken?: string;
    refreshToken?: string;
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

export interface GetUserByEmailParams {
    email: string;
}
