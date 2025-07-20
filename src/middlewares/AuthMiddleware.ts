import jwt, {JwtPayload} from 'jsonwebtoken';
import {NextFunction, Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ACCESS_TOKEN_SECRET} from "../config/config";

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({error: 'No token provided'});
        return;
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET!, (error, decoded) => {
        if (error) {
            res.status(403).json({error: 'Invalid or expired token'});
            return;
        }

        const payload = decoded as JwtPayload;
        (req as AuthRequest).userExternalId = payload.userExternalId as string;
        next();
    });
}

export {authMiddleware};
