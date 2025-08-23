import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {aiRateLimiter, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {
    analyzeSentimentController,
    classifyContentController,
    fetchComplexityMeterController,
    fetchKeyPointsController,
    generateTagsController,
    summarizeArticleController
} from "../controllers/AIController";

const router = Router();

router.post('/classify', classifyContentController);                                                            // /api/v1/ai/classify
router.post('/summarize', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, summarizeArticleController);  // /api/v1/ai/summarize
router.post('/sentiment', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, analyzeSentimentController);  // /api/v1/ai/sentiment
router.post('/generate-tags', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateTagsController);  // /api/v1/ai/generate-tags
router.post('/extract-key-points', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, fetchKeyPointsController);  // /api/v1/ai/extract-key-points
router.post('/complexity-meter', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, fetchComplexityMeterController);  // /api/v1/ai/complexity-meter
// TODO Implement: A progressive API for news article details screen, similar to /multi-source/enhanced

export default router;
