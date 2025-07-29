import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {checkGeminiAPIHealthController, summarizeArticleController} from "../controllers/AIController";
import {rateLimiterMiddleware} from "../middlewares/RateLimiterMiddleware";

const router = Router();

router.post('/summarize', authMiddleware, rateLimiterMiddleware, summarizeArticleController);       // /api/v1/ai/summarize
router.get('/health', checkGeminiAPIHealthController);                                              // /api/v1/ai/health

export default router;
