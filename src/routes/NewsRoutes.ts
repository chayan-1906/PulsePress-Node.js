import {Router} from "express";
import {getAllRSSFeedsController, getAllTopHeadlinesController} from "../controllers/NewsController";

const router = Router();

router.get('/top-headlines', getAllTopHeadlinesController);     // /api/v1/news/top-headlines?country=India&category=Sports&sources=techcrunch,hacker_news&q=eng vs ind 4th test&pageSize=12&page=1
router.get('/rss', getAllRSSFeedsController);                   // /api/v1/news/rss?sources=prothom_alo,zeenews_bengali&language=bengali&pageSize=12&page=2

export default router;
