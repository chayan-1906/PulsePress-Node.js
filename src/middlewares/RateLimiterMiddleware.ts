import rateLimit from 'express-rate-limit';
import {Request} from 'express';
import {AuthRequest} from '../types/auth';

// Create AI-specific rate limiter
const rateLimiterMiddleware = rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    limit: 10,              // 10 requests per minute per user
    keyGenerator: (req: Request) => {
        const authReq = req as AuthRequest;
        return authReq.userExternalId;
    },

    // Custom error message
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many AI requests. Please try again later.'
        }
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

export {rateLimiterMiddleware};
