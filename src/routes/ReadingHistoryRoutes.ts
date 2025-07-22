import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {
    clearHistoryController,
    completeArticleController,
    getReadingHistoriesController,
    getReadingHistoryAnalyticsController,
    modifyReadingHistoryController
} from "../controllers/ReadingHistoryController";

const router = Router();

router.post('/track', authMiddleware, modifyReadingHistoryController);      // /api/v1/reading-history/track
router.get('/', authMiddleware, getReadingHistoriesController);             // /api/v1/reading-history
router.put('/complete', authMiddleware, completeArticleController);         // /api/v1/reading-history
router.delete('/', authMiddleware, clearHistoryController);                 // /api/v1/reading-history
router.get('/stats', authMiddleware, getReadingHistoryAnalyticsController); // /api/v1/reading-history

export default router;
