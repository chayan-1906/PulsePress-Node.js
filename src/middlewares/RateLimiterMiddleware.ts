import {Request} from 'express';
import rateLimit from 'express-rate-limit';
import {AuthRequest} from '../types/auth';
import {NEWS_SCRAPING_MAX_REQUESTS, NEWS_SCRAPING_WINDOW_MS} from "../config/config";

// Create AI-specific rate limiter
const aiRateLimiterMiddleware = rateLimit({
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

// Create news scraping rate limiter
const newsScrapingRateLimiter = rateLimit({
    windowMs: Number(NEWS_SCRAPING_WINDOW_MS) || 15 * 60 * 1000,  // Default 15 minutes
    limit: Number(NEWS_SCRAPING_MAX_REQUESTS) || 50,              // Default 50 requests per window

    // Custom error message
    message: {
        success: false,
        error: {
            code: 'SCRAPING_RATE_LIMIT_EXCEEDED',
            message: `Too many scraping requests. You can make ${Number(NEWS_SCRAPING_MAX_REQUESTS) || 50} requests every ${Math.round((Number(NEWS_SCRAPING_WINDOW_MS) || 900000) / 60000)} minutes.`
        }
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting
    skipSuccessfulRequests: false,

    // Skip failed requests in counting
    skipFailedRequests: false,
});

export {aiRateLimiterMiddleware, newsScrapingRateLimiter};
