import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {aiRateLimiter, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {analyzeSentimentController, classifyContentController, fetchKeyPointsController, generateTagsController, summarizeArticleController} from "../controllers/AIController";

const router = Router();

router.post('/classify', classifyContentController);                                                            // /api/v1/ai/classify
router.post('/summarize', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, summarizeArticleController);  // /api/v1/ai/summarize
router.post('/sentiment', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, analyzeSentimentController);  // /api/v1/ai/sentiment // TODO: Make it GET API
router.post('/generate-tags', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateTagsController);  // /api/v1/ai/generate-tags // TODO: Make it GET API
router.post('/extract-key-points', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, fetchKeyPointsController);  // /api/v1/ai/extract-key-points // TODO: Make it GET API

export default router;
