import {Router} from "express";
import {
    checkDatabaseHealthController,
    checkGeminiAiHealthController,
    checkGoogleServicesHealthController,
    checkNewsApiOrgHealthController,
    checkOverallSystemHealthController,
    checkRssFeedsHealthController
} from "../controllers/HealthController";

const router = Router();

router.get('/news', checkNewsApiOrgHealthController);               // /health/news
router.get('/rss', checkRssFeedsHealthController);                  // /health/rss
router.get('/google-service', checkGoogleServicesHealthController); // /health/google-service
router.get('/ai', checkGeminiAiHealthController);                   // /health/ai
router.get('/database', checkDatabaseHealthController);             // /health/database
router.get('/', checkOverallSystemHealthController);                // /health

export default router;
