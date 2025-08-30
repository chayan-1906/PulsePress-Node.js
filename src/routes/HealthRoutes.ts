import {Router} from "express";
import {
    checkDatabaseHealthController,
    checkGeminiAIHealthController,
    checkGoogleServicesHealthController,
    checkNewsAPIOrgHealthController,
    checkOverallSystemHealthController,
    checkRSSFeedsHealthController
} from "../controllers/HealthController";

const router = Router();

router.get('/news', checkNewsAPIOrgHealthController);               // /health/news
router.get('/rss', checkRSSFeedsHealthController);                  // /health/rss
router.get('/google-service', checkGoogleServicesHealthController); // /health/google-service
router.get('/ai', checkGeminiAIHealthController);                   // /health/ai
router.get('/database', checkDatabaseHealthController);             // /health/database
router.get('/', checkOverallSystemHealthController);                // /health

export default router;
