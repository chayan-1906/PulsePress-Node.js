import 'colors';
import {Request} from 'express';
import rateLimit from 'express-rate-limit';
import {AuthRequest} from '../types/auth';
import {
    AI_MAX_REQUESTS,
    AI_WINDOW_MS,
    AUTH_MAX_REQUESTS,
    AUTH_WINDOW_MS,
    BOOKMARK_MAX_REQUESTS,
    BOOKMARK_WINDOW_MS,
    NEWS_SCRAPING_MAX_REQUESTS,
    NEWS_SCRAPING_WINDOW_MS,
    READING_HISTORY_MAX_REQUESTS,
    READING_HISTORY_WINDOW_MS,
    USER_PREFERENCES_MAX_REQUESTS,
    USER_PREFERENCES_WINDOW_MS
} from "../config/config";

// AI-specific (summarization) rate limiter
const aiRateLimiter = rateLimit({
    windowMs: Number(AI_WINDOW_MS) || 5 * 60 * 1000,  // 5 minute
    limit: Number(AI_MAX_REQUESTS) || 30,             // 30 requests per minute per user
    keyGenerator: (req: Request) => {
        const authReq = req as AuthRequest;
        console.warn('Rate Limit: AI request detected'.yellow, {userId: authReq.userExternalId});
        return authReq.userExternalId;
    },

    // Custom error message
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            // message: 'Too many AI requests. Please try again later',
            message: `Too many AI requests. You can make ${Number(AI_MAX_REQUESTS) || 10} requests every ${Math.round((Number(AI_WINDOW_MS) || 300000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

// News scraping rate limiter
const newsScrapingRateLimiter = rateLimit({
    windowMs: Number(NEWS_SCRAPING_WINDOW_MS) || 15 * 60 * 1000,  // Default 15 minutes
    limit: Number(NEWS_SCRAPING_MAX_REQUESTS) || 50,              // Default 50 requests per window
    
    skip: (req: Request) => {
        console.warn('Rate Limit: News scraping request detected'.yellow, {ip: req.ip});
        return false;
    },

    // Custom error message
    message: {
        success: false,
        error: {
            code: 'SCRAPING_RATE_LIMIT_EXCEEDED',
            message: `Too many scraping requests. You can make ${Number(NEWS_SCRAPING_MAX_REQUESTS) || 50} requests every ${Math.round((Number(NEWS_SCRAPING_WINDOW_MS) || 900000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

// Auth rate limiter
const authRateLimiter = rateLimit({
    windowMs: Number(AUTH_WINDOW_MS) || 15 * 60 * 1000,  // Default 15 minutes
    limit: Number(AUTH_MAX_REQUESTS) || 5,               // Default 5 attempts per window
    
    skip: (req: Request) => {
        console.warn('Rate Limit: Auth attempt detected'.yellow, {ip: req.ip});
        return false;
    },

    message: {
        success: false,
        error: {
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: `Too many authentication attempts. You can try ${Number(AUTH_MAX_REQUESTS) || 5} times every ${Math.round((Number(AUTH_WINDOW_MS) || 900000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

// bookmark rate limiter
const bookmarkRateLimiter = rateLimit({
    windowMs: Number(BOOKMARK_WINDOW_MS) || 5 * 60 * 1000,   // Default 5 minutes
    limit: Number(BOOKMARK_MAX_REQUESTS) || 20,              // Default 20 operations per window
    keyGenerator: (req: Request) => {
        const authReq = req as AuthRequest;
        return authReq.userExternalId;
    },

    message: {
        success: false,
        error: {
            code: 'BOOKMARK_RATE_LIMIT_EXCEEDED',
            message: `Too many bookmark operations. You can make ${Number(BOOKMARK_MAX_REQUESTS) || 20} requests every ${Math.round((Number(BOOKMARK_WINDOW_MS) || 300000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

// reading history rate limiter
const readingHistoryRateLimiter = rateLimit({
    windowMs: Number(READING_HISTORY_WINDOW_MS) || 5 * 60 * 1000,   // Default 5 minutes
    limit: Number(READING_HISTORY_MAX_REQUESTS) || 30,              // Default 30 operations per window
    keyGenerator: (req: Request) => {
        const authReq = req as AuthRequest;
        return authReq.userExternalId;
    },

    message: {
        success: false,
        error: {
            code: 'READING_HISTORY_RATE_LIMIT_EXCEEDED',
            message: `Too many reading history operations. You can make ${Number(READING_HISTORY_MAX_REQUESTS) || 30} requests every ${Math.round((Number(READING_HISTORY_WINDOW_MS) || 300000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

// user preference rate limiter
const userPreferencesRateLimiter = rateLimit({
    windowMs: Number(USER_PREFERENCES_WINDOW_MS) || 15 * 60 * 1000,   // Default 15 minutes
    limit: Number(USER_PREFERENCES_MAX_REQUESTS) || 10,               // Default 10 operations per window
    keyGenerator: (req: Request) => {
        const authReq = req as AuthRequest;
        return authReq.userExternalId;
    },

    message: {
        success: false,
        error: {
            code: 'USER_PREFERENCES_RATE_LIMIT_EXCEEDED',
            message: `Too many preference changes. You can make ${Number(USER_PREFERENCES_MAX_REQUESTS) || 10} requests every ${Math.round((Number(USER_PREFERENCES_WINDOW_MS) || 900000) / 60000)} minutes`,
        },
    },

    // Return JSON instead of HTML
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // Skip successful requests in counting (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in counting (optional)
    skipFailedRequests: false,
});

export {aiRateLimiter, newsScrapingRateLimiter, authRateLimiter, bookmarkRateLimiter, readingHistoryRateLimiter, userPreferencesRateLimiter};
