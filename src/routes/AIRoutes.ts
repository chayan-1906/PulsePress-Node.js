import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {parseQueryWithAIController, summarizeArticleController} from "../controllers/AIController";
import {aiRateLimiterMiddleware, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";

const router = Router();

router.post('/summarize', authMiddleware, aiRateLimiterMiddleware, newsScrapingRateLimiter, summarizeArticleController);    // /api/v1/ai/summarize
router.get('/smart-search', authMiddleware, aiRateLimiterMiddleware, parseQueryWithAIController);                           // /api/v1/ai/smart-search?query="Eng vs Ind 5-match test series"

export default router;
