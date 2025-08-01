import {Router} from "express";
import {getSourceAnalyticsController, getTopPerformingSourcesController} from "../controllers/AnalyticsController";

const router = Router();

router.get('/source', getSourceAnalyticsController);                // /api/v1/analytics/source?limit=10&sortBy=engagementScore&sortOrder=desc
router.get('/top-performer', getTopPerformingSourcesController);    // /api/v1/analytics/top-performer?limit=5&minViews=3

export default router;
