import {Router} from "express";
import {
    checkDatabaseHealthController,
    checkGeminiAIHealthController,
    checkGoogleServicesHealthController,
    checkNewsAPIHealthController,
    checkOverallSystemHealthController,
    checkRSSFeedsHealthController
} from "../controllers/HealthController";

const router = Router();

router.get('/news', checkNewsAPIHealthController);                  // /health/news
router.get('/rss', checkRSSFeedsHealthController);                  // /health/rss
router.get('/google-service', checkGoogleServicesHealthController); // /health/google-service
router.get('/ai', checkGeminiAIHealthController);                   // /health/ai
router.get('/database', checkDatabaseHealthController);             // /health/database
router.get('/', checkOverallSystemHealthController);                // /health

export default router;
