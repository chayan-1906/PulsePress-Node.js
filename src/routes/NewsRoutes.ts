import {Router} from "express";
import {fetchEverythingController, getAllRSSFeedsController, getAllTopHeadlinesController, scrapeWebsiteController} from "../controllers/NewsController";

const router = Router();

router.get('/top-headlines', getAllTopHeadlinesController);     // /api/v1/news/top-headlines?country=India&category=Sports&sources=techcrunch,hacker_news&q=eng vs ind 4th test&pageSize=12&page=1
router.get('/rss', getAllRSSFeedsController);                   // /api/v1/news/rss?sources=prothom_alo,zeenews_bengali&language=bengali&pageSize=12&page=2
router.get('/search', fetchEverythingController);               // /api/v1/news/search?sources=techcrunch&from=2025-06-27&to=2025-07-27&sortBy=publishedAt&language=spanish&q=tesla
router.post('/scrape', scrapeWebsiteController);                // /api/v1/news/scrape

export default router;
