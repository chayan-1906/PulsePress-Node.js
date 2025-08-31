import "colors";
import jwt, {JwtPayload} from 'jsonwebtoken';
import {NextFunction, Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {ACCESS_TOKEN_SECRET} from "../config/config";
import {generateInvalidCode, generateMissingCode} from "../utils/generateErrorCodes";

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        console.warn('Client Error: Missing authentication token'.yellow);
        res.status(401).send(new ApiResponse({
            success: false,
            errorCode: generateMissingCode('auth_token'),
            errorMsg: 'No token provided',
        }));
        return;
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET!, (error, decoded) => {
        if (error) {
            console.warn('Client Error: Invalid or expired token'.yellow);
            res.status(401).send(new ApiResponse({
                success: false,
                errorCode: generateInvalidCode('auth_token'),
                errorMsg: 'Invalid or expired token',
            }));
            return;
        }

        const payload = decoded as JwtPayload;
        (req as AuthRequest).userExternalId = payload.userExternalId as string;
        (req as AuthRequest).email = payload.email as string;
        console.debug('Debug: User authenticated'.gray, {userExternalId: payload.userExternalId});
        next();
    });
}

const authMiddlewareOptional = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        jwt.verify(token, ACCESS_TOKEN_SECRET!, (error, decoded) => {
            if (!error) {
                const payload = decoded as JwtPayload;
                (req as AuthRequest).userExternalId = payload.userExternalId as string;
                (req as AuthRequest).email = payload.email as string;
            }
        });
    }

    next();
}

export {authMiddleware, authMiddlewareOptional};
