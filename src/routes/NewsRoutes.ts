import {Router} from "express";
import {newsScrapingRateLimiter} from "../middlewares/RateLimiterMiddleware";
import {
    exploreTopicController,
    fetchAllRSSFeedsController,
    fetchGuardianNewsController,
    fetchMultiSourceNewsController,
    fetchNEWSORGEverythingController,
    fetchNEWSORGTopHeadlinesController,
    fetchNYTimesNewsController,
    fetchNYTimesTopStoriesController,
    scrapeWebsiteController,
} from "../controllers/NewsController";

const router = Router();

router.get('/newsapiorg/top-headlines', fetchNEWSORGTopHeadlinesController);     // /api/v1/news/newsapiorg/top-headlines?country=India&category=Sports&sources=techcrunch,hacker_news&q=eng vs ind 4th test&pageSize=12&page=1
router.get('/newsapiorg/search', fetchNEWSORGEverythingController);               // /api/v1/news/newsapiorg/search?sources=techcrunch&from=2025-06-27&to=2025-07-27&sortBy=publishedAt&language=spanish&q=tesla
router.get('/guardian/search', fetchGuardianNewsController);           // /api/v1/news/guardian/search?q=climate change&section=environment&pageSize=10
router.get('/nytimes/search', fetchNYTimesNewsController);      // /api/v1/news/nytimes/search?q=artificial intelligence&section=technology&sort=newest
router.get('/nytimes/top-stories', fetchNYTimesTopStoriesController); // /api/v1/news/nytimes/top-stories?section=technology
router.get('/rss', fetchAllRSSFeedsController);                   // /api/v1/news/rss?sources=prothom_alo,zeenews_bengali&language=bengali&pageSize=12&page=2
router.get('/multi-source', fetchMultiSourceNewsController);                   // /api/v1/news/rss?sources=prothom_alo,zeenews_bengali&language=bengali&pageSize=12&page=2
router.post('/scrape', newsScrapingRateLimiter, scrapeWebsiteController); // /api/v1/news/scrape
router.get('/explore/:topic', exploreTopicController); // /api/v1/news/explore/:topic

export default router;
