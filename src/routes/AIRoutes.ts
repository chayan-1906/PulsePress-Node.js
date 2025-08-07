import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {classifyContentController, summarizeArticleController} from "../controllers/AIController";
import {aiRateLimiterMiddleware, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";

const router = Router();

router.post('/classify', classifyContentController);                                                                        // /api/v1/ai/classify
router.post('/summarize', authMiddleware, aiRateLimiterMiddleware, newsScrapingRateLimiter, summarizeArticleController);    // /api/v1/ai/summarize

export default router;
