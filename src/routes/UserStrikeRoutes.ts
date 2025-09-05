import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {authRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {getUserStrikeHistoryController, getUserStrikeStatusController} from "../controllers/UserStrikeController";

const router = Router();

router.get('/status', authMiddleware, authRateLimiter, getUserStrikeStatusController);      // /api/v1/strikes/status
router.get('/history', authMiddleware, getUserStrikeHistoryController);    // /api/v1/strikes/history

export default router;
