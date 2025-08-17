import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {aiRateLimiter, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {analyzeSentimentController, classifyContentController, summarizeArticleController} from "../controllers/AIController";

const router = Router();

router.post('/classify', classifyContentController);                                                            // /api/v1/ai/classify
router.post('/summarize', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, summarizeArticleController);  // /api/v1/ai/summarize
router.post('/sentiment', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, analyzeSentimentController);  // /api/v1/ai/sentiment

export default router;
