import {EngagementScoreWeights} from "../types/analytics";

const RSS_SOURCES = {
    english: {
        techcrunch: 'https://techcrunch.com/feed/',
        bbc_tech: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
        hacker_news: 'https://hnrss.org/frontpage',
        wired: 'https://www.wired.com/feed/rss',
        ars_technica: 'https://feeds.arstechnica.com/arstechnica/index',
        engadget: 'https://www.engadget.com/rss.xml',
        verge: 'https://www.theverge.com/rss/index.xml',
        cnet: 'https://www.cnet.com/rss/news/',
        mashable: 'https://mashable.com/feeds/rss/all',
        zdnet: 'https://www.zdnet.com/news/rss.xml',
        techradar: 'https://www.techradar.com/rss',
        gizmodo: 'https://gizmodo.com/rss',

        timesofindia_top: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
        timesofindia_recent: 'https://timesofindia.indiatimes.com/rssfeedmostrecent.cms',
        timesofindia_india: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms',
        timesofindia_world: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
        timesofindia_sports: 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms',

        ndtv_top: 'https://feeds.feedburner.com/ndtvnews-top-stories',
        ndtv_latest: 'https://feeds.feedburner.com/ndtvnews-latest',
        ndtv_trending: 'https://feeds.feedburner.com/ndtvnews-trending-news',
        ndtv_india: 'https://feeds.feedburner.com/ndtvnews-india-news',
        ndtv_world: 'https://feeds.feedburner.com/ndtvnews-world-news',
        ndtv_sports: 'https://feeds.feedburner.com/ndtvsports-latest',
        ndtv_cricket: 'https://feeds.feedburner.com/ndtvsports-cricket',
        ndtv_tech: 'https://feeds.feedburner.com/gadgets360-latest',

        the_hindu_india: 'https://www.thehindu.com/news/national/feeder/default.rss',
        the_hindu_world: 'https://www.thehindu.com/news/international/feeder/default.rss',
        the_hindu_cricket: 'https://www.thehindu.com/sport/cricket/feeder/default.rss',
        the_hindu_economy: 'https://www.thehindu.com/business/Economy/feeder/default.rss',

        prothom_alo_english: 'https://prod-qt-images.s3.amazonaws.com/production/prothomalo-english/feed.xml',
    },
    bengali: {
        prothom_alo: 'https://www.prothomalo.com/feed/',
        oneindia_bengali: 'https://bengali.oneindia.com/rss/bengali-news-fb.xml',
        zeenews_bengali: 'https://zeenews.india.com/bengali/rss.xml',

        bbc_news_bengali: 'https://feeds.bbci.co.uk/bengali/rss.xml',

        // https://bengali.abplive.com/rss
        abp_live_bengali_home: 'https://bengali.abplive.com/home/feed',
        abp_live_india: 'https://bengali.abplive.com/news/india/feed',
        abp_live_district: 'https://bengali.abplive.com/district/feed',
        abp_live_kolkata: 'https://bengali.abplive.com/news/kolkata/feed',
        abp_live_states: 'https://bengali.abplive.com/states/feed',
        abp_live_world: 'https://bengali.abplive.com/news/world/feed',
        abp_live_sports: 'https://bengali.abplive.com/sports/feed',
        abp_live_education: 'https://bengali.abplive.com/education/feed',
        abp_live_technology: 'https://bengali.abplive.com/technology/feed',
        abp_live_election: 'https://bengali.abplive.com/elections/feed',
        abp_live_trending: 'https://bengali.abplive.com/trending/feed',

        bd24live: 'https://www.bd24live.com/bangla/feed',
        risingbd: 'https://www.risingbd.com/rss/rss.xml',

        bengali_news_18: 'https://bengali.news18.com/commonfeeds/v1/ben/rss/shows/kolkata-kolkata.xml',
        bengali_news_18_politics: 'https://bengali.news18.com/commonfeeds/v1/ben/rss/politics.xml',
        bengali_news_18_cricket: 'https://bengali.news18.com/commonfeeds/v1/ben/rss/sports/cricket.xml',
        bengali_news_18_elections: 'https://bengali.news18.com/commonfeeds/v1/ben/rss/elections.xml',
    },
    hindi: {
        // https://www.amarujala.com/rss
        amar_ujala_breaking: 'https://www.amarujala.com/rss/breaking-news.xml',
        amar_ujala_wb: 'https://www.amarujala.com/rss/west-bengal.xml',
        amar_ujala_delhi: 'https://www.amarujala.com/rss/delhi.xml',

        bbc_news_hindi: 'https://feeds.bbci.co.uk/hindi/rss.xml',

        zeenews_hindi: 'https://zeenews.india.com/hindi/rss.xml',

        oneindia_hindi: 'https://hindi.oneindia.com/rss/hindi-news-fb.xml',

        // https://www.abplive.com/rss
        abp_live_hindi_home: 'https://www.abplive.com/home/feed',
        abp_live_world: 'https://www.abplive.com/news/world/feed',
        abp_live_states: 'https://www.abplive.com/states/feed',
        abp_live_sports: 'https://www.abplive.com/sports/feed',
        abp_live_education: 'https://www.abplive.com/education/feed',
        abp_live_jobs: 'https://www.abplive.com/education/jobs/feed',
        abp_live_election: 'https://www.abplive.com/elections/feed',
        abp_live_trending: 'https://www.abplive.com/trending/feed',

        // https://zeenews.india.com/rss.html
        zeenews_india: 'https://zeenews.india.com/rss/india-national-news.xml',
        zeenews_world: 'https://zeenews.india.com/rss/world-news.xml',
        zeenews_asia: 'https://zeenews.india.com/rss/asia-news.xml',
        zeenews_sports: 'https://zeenews.india.com/rss/sports-news.xml',
        zeenews_tech: 'https://zeenews.india.com/rss/technology-news.xml',

        ndtv_hindi: 'https://feeds.feedburner.com/ndtvkhabar-latest',
    },
    multilingual: {
        timesofindia: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
    },
};

export const AI_MODELS = [
    'gemini-2.5-flash',           // Primary: Best balance, higher limits
    'gemini-2.0-flash-lite',      // Fallback 1: Highest RPM (30/min), good for news
    'gemini-2.0-flash',           // Fallback 2: Latest features, 1M context
    'gemini-2.5-flash-lite-preview-06-17', // Fallback 3: Highest daily limit (1,000)
    'gemini-1.5-flash'            // Last resort: Your current (deprecated)
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
];

const DEFAULT_ENGAGEMENT_WEIGHTS: EngagementScoreWeights = {
    viewWeight: 1,
    bookmarkWeight: 3,
    completionWeight: 2,
    readingTimeWeight: 0.1,
};

export {RSS_SOURCES, USER_AGENTS, DEFAULT_ENGAGEMENT_WEIGHTS};
