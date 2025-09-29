import {Router} from "express";
import {
    checkAIComplexityMeterHealthController,
    checkAIQuestionAnswerHealthController,
    checkAIGeographicExtractionHealthController,
    checkAIKeyPointsExtractionHealthController,
    checkAINewsInsightsHealthController,
    checkAISocialMediaCaptionHealthController,
    checkAISentimentAnalysisHealthController,
    checkAISummarizationHealthController,
    checkAITagGenerationHealthController,
    checkDatabaseHealthController,
    checkEmailServiceHealthController,
    checkGoogleServicesHealthController,
    checkGuardianApiHealthController,
    checkHuggingFaceApiHealthController,
    checkNewsApiOrgHealthController,
    checkNyTimesApiHealthController,
    checkOverallSystemHealthController,
    checkRssFeedsHealthController,
    checkWebScrapingServiceHealthController,
} from "../controllers/HealthController";

const router = Router();

router.get('/news', checkNewsApiOrgHealthController);                   // /health/news
router.get('/guardian', checkGuardianApiHealthController);              // /health/guardian
router.get('/nytimes', checkNyTimesApiHealthController);                // /health/nytimes
router.get('/rss', checkRssFeedsHealthController);                      // /health/rss
router.get('/email', checkEmailServiceHealthController);                // /health/email
router.get('/webscraping', checkWebScrapingServiceHealthController);    // /health/webscraping
router.get('/google-service', checkGoogleServicesHealthController);     // /health/google-service
router.get('/ai-summarization', checkAISummarizationHealthController);  // /health/ai-summarization
router.get('/ai-tag-generation', checkAITagGenerationHealthController); // /health/ai-tag-generation
router.get('/ai-sentiment-analysis', checkAISentimentAnalysisHealthController); // /health/ai-sentiment-analysis
router.get('/ai-key-points-extraction', checkAIKeyPointsExtractionHealthController); // /health/ai-key-points-extraction
router.get('/ai-complexity-meter', checkAIComplexityMeterHealthController); // /health/ai-complexity-meter
router.get('/ai-question-answer', checkAIQuestionAnswerHealthController); // /health/ai-question-answer
router.get('/ai-geographic-extraction', checkAIGeographicExtractionHealthController); // /health/ai-geographic-extraction
router.get('/ai-social-media-caption', checkAISocialMediaCaptionHealthController); // /health/ai-social-media-caption
router.get('/ai-news-insights', checkAINewsInsightsHealthController); // /health/ai-news-insights
router.get('/huggingface-ai', checkHuggingFaceApiHealthController);     // /health/huggingface-ai
router.get('/database', checkDatabaseHealthController);                 // /health/database
router.get('/', checkOverallSystemHealthController);                    // /

export default router;
