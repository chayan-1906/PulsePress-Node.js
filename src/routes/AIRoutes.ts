import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {summarizeArticleController} from "../controllers/AIController";

const router = Router();

router.post('/summarize', authMiddleware, summarizeArticleController);                   // /api/v1/ai/summarize

export default router;
