import {Router} from "express";
import {getAllRSSFeedsController, getAllTopHeadlinesController} from "../controllers/NewsController";

const router = Router();

router.get('/top-headlines', getAllTopHeadlinesController);     // /api/v1/news/top-headlines?country={country}&category={category}&sources={sources}&q={q}&pageSize={pageSize}&page={page}
router.get('/rss', getAllRSSFeedsController);                   // /api/v1/news/rss

export default router;
