import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {summarizeArticleController} from "../controllers/AIController";
import {rateLimiterMiddleware} from "../middlewares/RateLimiterMiddleware";

const router = Router();

router.post('/summarize', authMiddleware, rateLimiterMiddleware, summarizeArticleController);       // /api/v1/ai/summarize

export default router;
