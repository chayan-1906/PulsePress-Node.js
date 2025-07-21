import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {getAllBookmarksController, getBookmarkCountController, isBookmarkedController, toggleBookmarkController} from "../controllers/BookmarkController";

const router = Router();

router.put('/toggle', authMiddleware, toggleBookmarkController);        // /api/v1/bookmark/toggle
router.get('/status', authMiddleware, isBookmarkedController);          // /api/v1/bookmark/status
router.get('/', authMiddleware, getAllBookmarksController);             // /api/v1/bookmark
router.get('/count', authMiddleware, getBookmarkCountController);       // /api/v1/bookmark/count

export default router;
