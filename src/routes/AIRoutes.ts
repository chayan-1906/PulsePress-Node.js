import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {aiRateLimiter, newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {
    analyzeComplexityController,
    analyzeSentimentController,
    answerQuestionController,
    classifyContentController,
    extractKeyPointsController,
    extractLocationsController,
    generateNewsInsightsController,
    generateQuestionsController,
    generateSocialMediaCaptionController,
    generateTagsController,
    summarizeArticleController,
} from "../controllers/AIController";

const router = Router();

router.post('/classify', classifyContentController);                                                            // /api/v1/ai/classify
router.post('/summarize', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, summarizeArticleController);  // /api/v1/ai/summarize
router.post('/generate-tags', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateTagsController);  // /api/v1/ai/generate-tags
router.post('/sentiment', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, analyzeSentimentController);  // /api/v1/ai/sentiment
router.post('/extract-key-points', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, extractKeyPointsController);  // /api/v1/ai/extract-key-points
router.post('/complexity-meter', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, analyzeComplexityController);  // /api/v1/ai/complexity-meter
router.post('/generate-questions', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateQuestionsController);  // /api/v1/ai/generate-questions
router.post('/answer-question', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, answerQuestionController);  // /api/v1/ai/answer-question
router.post('/extract-locations', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, extractLocationsController);  // /api/v1/ai/extract-locations
router.post('/social-media-caption', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateSocialMediaCaptionController);  // /api/v1/ai/social-media-caption
router.post('/news-insights', authMiddleware, aiRateLimiter, newsScrapingRateLimiter, generateNewsInsightsController);  // /api/v1/ai/news-insights
// TODO Implement: A progressive API for news article details screen, similar to /multi-source/enhanced

export default router;
