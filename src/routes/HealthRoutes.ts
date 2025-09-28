import {Router} from "express";
import {
    checkDatabaseHealthController,
    checkEmailServiceHealthController,
    checkWebScrapingServiceHealthController,
    checkGeminiAiHealthController,
    checkGoogleServicesHealthController,
    checkGuardianApiHealthController,
    checkNewsApiOrgHealthController,
    checkNyTimesApiHealthController,
    checkOverallSystemHealthController,
    checkRssFeedsHealthController,
} from "../controllers/HealthController";

const router = Router();

router.get('/news', checkNewsApiOrgHealthController);               // /health/news
router.get('/guardian', checkGuardianApiHealthController);          // /health/guardian
router.get('/nytimes', checkNyTimesApiHealthController);            // /health/nytimes
router.get('/rss', checkRssFeedsHealthController);                  // /health/rss
router.get('/email', checkEmailServiceHealthController);            // /health/email
router.get('/webscraping', checkWebScrapingServiceHealthController); // /health/webscraping
router.get('/google-service', checkGoogleServicesHealthController); // /health/google-service
router.get('/database', checkDatabaseHealthController);             // /health/database
router.get('/ai', checkGeminiAiHealthController);                   // /health/ai
router.get('/', checkOverallSystemHealthController);                // /health

export default router;
