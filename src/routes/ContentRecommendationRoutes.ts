import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {getContentRecommendationController} from "../controllers/ContentRecommendationController";

const router = Router();

router.get('/', authMiddleware, getContentRecommendationController);       // /api/v1/recommendation

export default router;
