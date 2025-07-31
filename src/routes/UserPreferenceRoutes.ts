import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {userPreferencesRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {getUserPreferenceController, modifyUserPreferenceController, resetUserPreferenceController} from "../controllers/UserPreferenceController";

const router = Router();

router.put('/', authMiddleware, userPreferencesRateLimiter, modifyUserPreferenceController);        // /api/v1/preferences
router.get('/', authMiddleware, getUserPreferenceController);                                       // /api/v1/preferences
router.put('/reset', authMiddleware, userPreferencesRateLimiter, resetUserPreferenceController);    // /api/v1/preferences/reset

export default router;
