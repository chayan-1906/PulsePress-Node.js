import {IEngagementScoreWeights} from "../types/analytics";

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

        bbc_news: "https://feeds.bbci.co.uk/news/rss.xml",
        nbc_news: "https://feeds.nbcnews.com/nbcnews/public/news",
        sky_news: "https://feeds.skynews.com/feeds/rss/home.xml",
        al_jazeera: "https://www.aljazeera.com/xml/rss/all.xml",
        marketwatch_top: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        indian_express: "https://indianexpress.com/feed",
        economic_times: "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        business_standard: "https://www.business-standard.com/rss/home_page_top_stories.rss",
        livemint: "https://www.livemint.com/rss/news",
        moneycontrol: "https://www.moneycontrol.com/rss/latestnews.xml",
        espn: "https://www.espn.com/espn/rss/news",

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

        // https://www.nytimes.com/rss
        nytWorld: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
        nytAmerica: 'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml',
        nytUS: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
        nytAsiaPacific: 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml',
        nytBusiness: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
        nytTechnology: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        nytPersonalTech: 'https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml',
        nytSports: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
        nytTMagazine: 'https://rss.nytimes.com/services/xml/rss/nyt/tmagazine.xml',

        // https://b2b.economictimes.indiatimes.com/rss
        b2bTopStories: 'https://b2b.economictimes.indiatimes.com/rss/topstories',
        b2bRecentStories: 'https://b2b.economictimes.indiatimes.com/rss/recentstories',
        b2bGovt: 'https://b2b.economictimes.indiatimes.com/rss/government',
        b2bRetail: 'https://b2b.economictimes.indiatimes.com/rss/retail',
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

export const AI_MODELS = {
    GEMINI_25_FLASH_LITE: 'gemini-2.5-flash-lite',
    GEMINI_25_FLASH: 'gemini-2.5-flash',
    GEMINI_20_FLASH: 'gemini-2.0-flash',
    GEMINI_20_FLASH_LITE: 'gemini-2.0-flash-lite',
    GEMINI_15_FLASH: 'gemini-1.5-flash',
} as const;

export const AI_SUMMARIZATION_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,                // 1,000 RPD | 15 RPM | 250K TPM - ⭐ PRIMARY (10x quota vs Pro)
    AI_MODELS.GEMINI_25_FLASH,                     // 250 RPD | 10 RPM | 250K TPM - FALLBACK #1
    AI_MODELS.GEMINI_20_FLASH,                     // 200 RPD | 15 RPM | 1M TPM - FALLBACK #2
    AI_MODELS.GEMINI_20_FLASH_LITE,                // 200 RPD | 30 RPM | 1M TPM - FALLBACK #3 (fastest RPM)
    // 'gemini-2.5-flash-lite-preview-06-17',      // NO FREE TIER - Will cause billing!
    AI_MODELS.GEMINI_15_FLASH,                     // Legacy model - Keep as final fallback

    // HuggingFace fallbacks (reliable and tested models)
    // 'huggingface:sshleifer/distilbart-cnn-12-6',
    // 'huggingface:sshleifer/distilbart-cnn-6-6',
    // 'huggingface:facebook/bart-large-cnn',
];

export const AI_TAG_GENERATION_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary choice for tag generation
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_SENTIMENT_ANALYSIS_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for sentiment analysis
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_KEY_POINTS_EXTRACTOR_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for key point extraction
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_COMPLEXITY_METER__MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for complexity analysis
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const QUESTION_ANSWER_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for Q&A
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_GEOGRAPHIC_EXTRACTION_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for geo extraction
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for caption generation
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_NEWS_INSIGHTS_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for news insights
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const AI_ENHANCEMENT_MODELS = [
    AI_MODELS.GEMINI_25_FLASH_LITE,  // 1,000 RPD - Primary for article enhancement
    AI_MODELS.GEMINI_25_FLASH,       // 250 RPD - Fallback #1
    AI_MODELS.GEMINI_20_FLASH,       // 200 RPD - Fallback #2
    AI_MODELS.GEMINI_20_FLASH_LITE,  // 200 RPD - Fallback #3
    AI_MODELS.GEMINI_15_FLASH,       // Legacy fallback
];

export const API_QUOTA_LIMITS = {
    // Conservative 90% limits to prevent accidental overruns
    'gemini-total': 900,                             // Shared pool across all Gemini models
    [AI_MODELS.GEMINI_25_FLASH_LITE]: 900,           // 1000 RPD * 0.9
    [AI_MODELS.GEMINI_25_FLASH]: 225,                // 250 RPD * 0.9
    [AI_MODELS.GEMINI_20_FLASH]: 180,                // 200 RPD * 0.9
    [AI_MODELS.GEMINI_20_FLASH_LITE]: 180,           // 200 RPD * 0.9
    [AI_MODELS.GEMINI_15_FLASH]: 90,                 // 100 RPD * 0.9
    newsapi: 100,                                    // NewsAPI.org free tier (2025: 100 requests/day + 24hr delay)
    guardian: 5000,                                  // Guardian API free tier (2025: 5,000 requests/day, 12/second)
    nytimes: 500,                                    // NYTimes API free tier (2025: 500 requests/day, 5/minute)
    google_translate: 16667,                         // Google Translate free tier (2025: 500K chars/month ≈ 16,667/day)
} as const;

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
];

const DEFAULT_ENGAGEMENT_WEIGHTS: IEngagementScoreWeights = {
    viewWeight: 1,
    bookmarkWeight: 3,
    completionWeight: 2,
    readingTimeWeight: 0.1,
};

const TRUSTED_NEWS_SOURCES = {
    // Tier 1: Premium sources (highest credibility)
    tier1: [
        'bbc', 'guardian', 'nytimes', 'reuters', 'associated press', 'ap news',
        'wall street journal', 'financial times', 'washington post', 'the times',
        'npr', 'pbs', 'abc news', 'cbs news', 'nbc news', 'cnn',
        'the hindu', 'times of india', 'indian express', 'ndtv',
    ],

    // Tier 2: Reliable sources (good credibility)
    tier2: [
        'sky news', 'bloomberg', 'cnbc', 'al jazeera', 'axios',
        'politico', 'the hill', 'usa today', 'la times', 'reuters',
        'economic times', 'business standard', 'livemint', 'moneycontrol',
        'espn', 'bbc sport', 'sky sports', 'atlantic', 'new yorker',
    ],

    // Tier 3: Acceptable sources (moderate credibility)
    tier3: [
        'techcrunch', 'wired', 'ars technica', 'engadget', 'the verge',
        'cnet', 'zdnet', 'mashable', 'gizmodo', 'techradar',
        'prothom alo', 'zeenews', 'abp live', 'news18', 'variety',
    ],
};

const TOPIC_SPECIFIC_SOURCES = {
    // Sports
    sports: ['espn', 'bbc-sport', 'sky-sports', 'the-sport-bible', 'talksport', 'ndtv_sports', 'ndtv_cricket', 'the_hindu_cricket', 'timesofindia_sports', 'sporting-news', 'sportsnet'],

    // Technology
    technology: ['techcrunch', 'ars-technica', 'the-verge', 'wired', 'engadget', 'cnet', 'zdnet', 'mashable', 'gizmodo', 'techradar', 'recode', 'ndtv_tech', 'hacker-news'],

    // Business & Finance
    business: ['bloomberg', 'financial-times', 'the-wall-street-journal', 'cnbc', 'business-insider', 'marketwatch', 'fortune', 'forbes'],

    // Health & Science
    health: ['bbc-news', 'cnn', 'reuters', 'associated-press', 'medical-news-today', 'webmd', 'healthline', 'new-scientist', 'nature', 'science-magazine'],

    // Politics
    politics: ['bbc-news', 'cnn', 'reuters', 'associated-press', 'politico', 'the-hill', 'axios', 'washington-post', 'nytimes'],

    // Entertainment
    entertainment: ['entertainment-weekly', 'variety', 'hollywood-reporter', 'deadline', 'tmz', 'enews', 'people', 'rolling-stone', 'billboard'],

    // General News
    general: ['bbc-news', 'cnn', 'reuters', 'associated-press', 'al-jazeera', 'sky-news'],
};

const COMPREHENSIVE_TOPIC_KEYWORDS = {
    // News & Politics
    politics: [
        'election', 'government', 'parliament', 'congress', 'senate', 'voting', 'campaign', 'policy', 'law', 'legislation', 'minister', 'president', 'prime minister', 'diplomacy',
        'international relations', 'summit', 'treaty', 'sanctions',
    ],

    crime: ['crime', 'arrest', 'investigation', 'police', 'court', 'trial', 'verdict', 'murder', 'robbery', 'fraud', 'corruption', 'lawsuit', 'justice'],

    // Business & Finance
    business: [
        'economy', 'market', 'stock', 'finance', 'earnings', 'revenue', 'profit', 'merger', 'acquisition', 'ipo', 'investment', 'venture capital', 'startup', 'inflation', 'gdp', 'recession', 'growth',
        'employment', 'jobs',
    ],

    finance: ['banking', 'cryptocurrency', 'bitcoin', 'trading', 'forex', 'bonds', 'interest rates', 'federal reserve', 'monetary policy', 'fiscal policy'],

    // Technology
    technology: [
        'tech', 'software', 'hardware', 'artificial intelligence', 'ai', 'machine learning', 'blockchain', 'cybersecurity', 'data breach', 'privacy', 'innovation', 'smartphone', 'app',
        'cloud computing', 'internet', 'digital',
    ],

    social_media: ['facebook', 'twitter', 'instagram', 'tiktok', 'youtube', 'social media', 'platform', 'content moderation', 'algorithm', 'influencer'],

    // Science & Health
    health: [
        'health', 'medicine', 'medical', 'disease', 'treatment', 'vaccine', 'clinical trial', 'drug', 'hospital', 'doctor', 'patient', 'healthcare', 'pandemic', 'epidemic', 'virus', 'bacteria',
        'mental health',
    ],

    science: ['research', 'study', 'discovery', 'experiment', 'scientist', 'laboratory', 'physics', 'chemistry', 'biology', 'genetics', 'dna', 'evolution'],

    environment: [
        'climate change', 'global warming', 'environment', 'pollution', 'renewable energy', 'solar', 'wind power', 'carbon emissions', 'sustainability', 'conservation', 'wildlife', 'extinction',
        'deforestation', 'recycling',
    ],

    space: ['space', 'nasa', 'rocket', 'satellite', 'mars', 'moon', 'astronaut', 'space station', 'telescope', 'planet', 'galaxy', 'universe'],

    // Sports
    sports: ['sport', 'game', 'match', 'tournament', 'championship', 'league', 'team', 'player', 'athlete', 'coach', 'score', 'win', 'lose'],

    cricket: ['cricket', 'test match', 'odi', 't20', 'ipl', 'world cup', 'series', 'innings', 'wicket', 'runs', 'bowler', 'batsman', 'captain'],

    football: ['football', 'soccer', 'premier league', 'champions league', 'fifa', 'uefa', 'goal', 'penalty', 'referee', 'transfer', 'world cup'],

    basketball: ['basketball', 'nba', 'playoff', 'finals', 'draft', 'trade', 'mvp', 'championship', 'coach', 'player'],

    // Entertainment
    entertainment: ['movie', 'film', 'cinema', 'actor', 'actress', 'director', 'producer', 'box office', 'premiere', 'festival', 'award', 'oscar', 'emmy'],

    music: ['music', 'song', 'album', 'artist', 'singer', 'concert', 'tour', 'grammy', 'chart', 'streaming', 'spotify', 'billboard'],

    celebrity: ['celebrity', 'star', 'fame', 'gossip', 'relationship', 'marriage', 'divorce', 'scandal', 'red carpet', 'paparazzi'],

    // Lifestyle & Society
    travel: ['travel', 'tourism', 'vacation', 'destination', 'flight', 'hotel', 'cruise', 'airline', 'airport', 'visa', 'passport'],

    food: ['food', 'restaurant', 'chef', 'cuisine', 'recipe', 'nutrition', 'diet', 'cooking', 'farming', 'agriculture'],

    fashion: ['fashion', 'style', 'designer', 'brand', 'model', 'runway', 'clothing', 'trend', 'luxury', 'retail'],

    education: ['education', 'school', 'university', 'college', 'student', 'teacher', 'graduation', 'degree', 'scholarship', 'exam', 'curriculum'],

    // Weather & Disasters
    weather: ['weather', 'storm', 'hurricane', 'typhoon', 'tornado', 'flood', 'drought', 'earthquake', 'tsunami', 'volcano', 'wildfire', 'natural disaster', 'emergency', 'evacuation'],

    // Transportation
    automotive: ['car', 'vehicle', 'electric vehicle', 'tesla', 'automotive', 'driving', 'accident', 'traffic', 'fuel', 'engine'],

    aviation: ['aviation', 'aircraft', 'airline', 'flight', 'pilot', 'airport', 'boeing', 'airbus', 'crash', 'safety'],

    // Energy
    energy: ['energy', 'oil', 'gas', 'petroleum', 'coal', 'nuclear', 'renewable', 'solar', 'wind', 'hydroelectric', 'battery']
};

const TOPIC_QUERIES = {
    technology: 'artificial intelligence technology innovation software cybersecurity',
    business: 'stock market earnings economy corporate finance',
    world: 'international politics government diplomacy world news',
    health: 'medical research healthcare public health wellness',
    sports: 'sports games tournaments athletics championship',
    science: 'scientific research climate space discovery',
    entertainment: 'movies music celebrities entertainment industry',
    climate: 'climate change global warming environmental sustainability',
    crypto: 'cryptocurrency bitcoin blockchain digital assets',
    ai: 'artificial intelligence machine learning ChatGPT automation',
    space: 'space exploration NASA SpaceX astronomy satellites',
    auto: 'electric vehicles Tesla automotive industry transportation',
    food: 'food industry agriculture nutrition restaurant chains',
} as const;

const TOPIC_METADATA = {
    technology: {name: 'Technology', description: 'Software, gadgets, cybersecurity, innovation'},
    business: {name: 'Business', description: 'Markets, finance, corporate news'},
    world: {name: 'World Affairs', description: 'Politics, international news, diplomacy'},
    health: {name: 'Health', description: 'Medical research, healthcare, wellness'},
    sports: {name: 'Sports', description: 'Games, tournaments, athletics'},
    science: {name: 'Science', description: 'Research, discoveries, studies'},
    entertainment: {name: 'Entertainment', description: 'Movies, music, celebrities'},
    climate: {name: 'Climate', description: 'Environment, sustainability, global warming'},
    crypto: {name: 'Crypto', description: 'Bitcoin, blockchain, digital assets'},
    ai: {name: 'AI', description: 'Machine learning, ChatGPT, automation'},
    space: {name: 'Space', description: 'NASA, SpaceX, astronomy, satellites'},
    auto: {name: 'Automotive', description: 'Electric vehicles, Tesla, transportation'},
    food: {name: 'Food', description: 'Agriculture, nutrition, food industry'}
} as const;

const COUNTRY_KEYWORDS = {
    india: 'India Indian Mumbai Delhi Bangalore Kolkata',
    china: 'China Chinese Beijing Shanghai',
    usa: 'United States American US',
    uk: 'United Kingdom British UK London',
    germany: 'Germany German Berlin',
    japan: 'Japan Japanese Tokyo',
} as const;

export const API_CONFIG = {
    NEWS_API: {
        RESULT_MULTIPLIER: 3,
        DEFAULT_PAGE_SIZE: 10,
        MAX_CONTENT_LENGTH: 4000,
    },
    SEARCH: {
        FUSE_THRESHOLD: 0.4,
        MIN_QUERY_LENGTH: 3,
        // CACHE_TTL_MS: 300000,
        CACHE_TTL_MS: 1800000, // 30 minutes (30 * 60 * 1000)
    },
};

export {
    RSS_SOURCES,
    USER_AGENTS,
    DEFAULT_ENGAGEMENT_WEIGHTS,
    TRUSTED_NEWS_SOURCES,
    TOPIC_SPECIFIC_SOURCES,
    COMPREHENSIVE_TOPIC_KEYWORDS,
    TOPIC_QUERIES,
    TOPIC_METADATA,
    COUNTRY_KEYWORDS,
};
