import {Router} from "express";
import {authMiddleware} from "../middlewares/AuthMiddleware";
import {bookmarkRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {getAllBookmarksController, getBookmarkCountController, isBookmarkedController, searchBookmarksController, toggleBookmarkController} from "../controllers/BookmarkController";

const router = Router();

router.put('/toggle', authMiddleware, bookmarkRateLimiter, toggleBookmarkController);        // /api/v1/bookmark/toggle
router.get('/status', authMiddleware, isBookmarkedController);          // /api/v1/bookmark/status
router.get('/', authMiddleware, getAllBookmarksController);             // /api/v1/bookmark
router.get('/count', authMiddleware, getBookmarkCountController);       // /api/v1/bookmark/count
router.get('/search', authMiddleware, searchBookmarksController);       // /api/v1/bookmark/search?q=ind&sources=ndtv,timesofindia&sortBy=readDuration&sortOrder=asc

export default router;
