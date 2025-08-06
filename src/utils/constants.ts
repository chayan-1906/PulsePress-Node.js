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

        // https://www.nytimes.com/rss, https://b2b.economictimes.indiatimes.com/rss
        // TODO: ADD RSS FEEDS
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

export const AI_SUMMARIZATION_MODELS = [
    'gemini-2.5-flash',           // Primary: Best balance, higher limits
    'gemini-2.0-flash-lite',      // Fallback 1: Highest RPM (30/min), good for news
    'gemini-2.0-flash',           // Fallback 2: Latest features, 1M context
    'gemini-2.5-flash-lite-preview-06-17', // Fallback 3: Highest daily limit (1,000)
    'gemini-1.5-flash'            // Last resort: Your current (deprecated)
];

export const AI_QUERY_PARSING_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite-preview',
    'gemini-1.5-flash',
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

// Content Quality Filtering Constants
export const LOW_QUALITY_CONTENT_INDICATORS = [
    // Puzzles & Games
    'crossword', 'puzzle', 'sudoku', 'word game', 'quiz', 'riddle', 'trivia',

    // Opinion/Letters (not hard news)
    'letter to editor', 'letters to the editor', 'dear editor', 'opinion piece',
    'reader mail', 'your letters', 'readers write', 'op-ed', 'editorial',

    // Social/Personal content
    'horoscope', 'astrology', 'daily forecast', 'wedding announcement',
    'birth announcement', 'anniversary', 'obituary', 'death notice',

    // Non-news content
    'recipe', 'cooking tips', 'fashion tips', 'lifestyle advice', 'how to',
    'think out loud', 'briefing', 'newsletter', 'recap', 'roundup',

    // Low-quality indicators
    'click here', 'you won\'t believe', 'shocking truth', 'celebrities hate',
    'doctors hate this', 'one weird trick', 'amazing secret', 'must see',
];

export const TRUSTED_NEWS_SOURCES = {
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

export const TOPIC_SPECIFIC_SOURCES = {
    // Sports
    sports: [
        'espn', 'bbc-sport', 'sky-sports', 'the-sport-bible', 'talksport',
        'ndtv_sports', 'ndtv_cricket', 'the_hindu_cricket', 'timesofindia_sports',
        'atletico-madura', 'sporting-news', 'sportsnet'
    ],

    // Technology
    technology: [
        'techcrunch', 'ars-technica', 'the-verge', 'wired', 'engadget',
        'cnet', 'zdnet', 'mashable', 'gizmodo', 'techradar', 'recode',
        'ndtv_tech', 'hacker-news'
    ],

    // Business & Finance
    business: [
        'bloomberg', 'financial-times', 'wall-street-journal', 'cnbc',
        'business-insider', 'marketwatch', 'economic_times', 'business_standard',
        'livemint', 'moneycontrol', 'fortune', 'forbes'
    ],

    // Health & Science
    health: [
        'bbc-news', 'cnn', 'reuters', 'associated-press', 'medical-news-today',
        'webmd', 'healthline', 'new-scientist', 'nature', 'science-magazine'
    ],

    // Politics
    politics: [
        'bbc-news', 'cnn', 'reuters', 'associated-press', 'politico',
        'the-hill', 'axios', 'the_hindu_india', 'ndtv_top', 'indian_express',
        'washington-post', 'nytimes'
    ],

    // Entertainment
    entertainment: [
        'entertainment-weekly', 'variety', 'hollywood-reporter', 'deadline',
        'tmz', 'e-news', 'people-magazine', 'rolling-stone', 'billboard'
    ],

    // General News
    general: [
        'bbc-news', 'cnn', 'reuters', 'associated-press', 'al-jazeera',
        'ndtv_top', 'the_hindu_india', 'timesofindia_top', 'sky-news'
    ]
};

export const COMPREHENSIVE_TOPIC_KEYWORDS = {
    // News & Politics
    politics: [
        'election', 'government', 'parliament', 'congress', 'senate', 'voting', 'campaign',
        'policy', 'law', 'legislation', 'minister', 'president', 'prime minister',
        'diplomacy', 'international relations', 'summit', 'treaty', 'sanctions'
    ],

    crime: [
        'crime', 'arrest', 'investigation', 'police', 'court', 'trial', 'verdict',
        'murder', 'robbery', 'fraud', 'corruption', 'lawsuit', 'justice'
    ],

    // Business & Finance
    business: [
        'economy', 'market', 'stock', 'finance', 'earnings', 'revenue', 'profit',
        'merger', 'acquisition', 'ipo', 'investment', 'venture capital', 'startup',
        'inflation', 'gdp', 'recession', 'growth', 'employment', 'jobs'
    ],

    finance: [
        'banking', 'cryptocurrency', 'bitcoin', 'trading', 'forex', 'bonds',
        'interest rates', 'federal reserve', 'monetary policy', 'fiscal policy'
    ],

    // Technology
    technology: [
        'tech', 'software', 'hardware', 'artificial intelligence', 'ai', 'machine learning',
        'blockchain', 'cybersecurity', 'data breach', 'privacy', 'innovation',
        'smartphone', 'app', 'cloud computing', 'internet', 'digital'
    ],

    social_media: [
        'facebook', 'twitter', 'instagram', 'tiktok', 'youtube', 'social media',
        'platform', 'content moderation', 'algorithm', 'influencer'
    ],

    // Science & Health
    health: [
        'health', 'medicine', 'medical', 'disease', 'treatment', 'vaccine',
        'clinical trial', 'drug', 'hospital', 'doctor', 'patient', 'healthcare',
        'pandemic', 'epidemic', 'virus', 'bacteria', 'mental health'
    ],

    science: [
        'research', 'study', 'discovery', 'experiment', 'scientist', 'laboratory',
        'physics', 'chemistry', 'biology', 'genetics', 'dna', 'evolution'
    ],

    environment: [
        'climate change', 'global warming', 'environment', 'pollution', 'renewable energy',
        'solar', 'wind power', 'carbon emissions', 'sustainability', 'conservation',
        'wildlife', 'extinction', 'deforestation', 'recycling'
    ],

    space: [
        'space', 'nasa', 'rocket', 'satellite', 'mars', 'moon', 'astronaut',
        'space station', 'telescope', 'planet', 'galaxy', 'universe'
    ],

    // Sports
    sports: [
        'sport', 'game', 'match', 'tournament', 'championship', 'league',
        'team', 'player', 'athlete', 'coach', 'score', 'win', 'lose'
    ],

    cricket: [
        'cricket', 'test match', 'odi', 't20', 'ipl', 'world cup', 'series',
        'innings', 'wicket', 'runs', 'bowler', 'batsman', 'captain'
    ],

    football: [
        'football', 'soccer', 'premier league', 'champions league', 'fifa', 'uefa',
        'goal', 'penalty', 'referee', 'transfer', 'world cup'
    ],

    basketball: [
        'basketball', 'nba', 'playoff', 'finals', 'draft', 'trade', 'mvp',
        'championship', 'coach', 'player'
    ],

    // Entertainment
    entertainment: [
        'movie', 'film', 'cinema', 'actor', 'actress', 'director', 'producer',
        'box office', 'premiere', 'festival', 'award', 'oscar', 'emmy'
    ],

    music: [
        'music', 'song', 'album', 'artist', 'singer', 'concert', 'tour',
        'grammy', 'chart', 'streaming', 'spotify', 'billboard'
    ],

    celebrity: [
        'celebrity', 'star', 'fame', 'gossip', 'relationship', 'marriage',
        'divorce', 'scandal', 'red carpet', 'paparazzi'
    ],

    // Lifestyle & Society
    travel: [
        'travel', 'tourism', 'vacation', 'destination', 'flight', 'hotel',
        'cruise', 'airline', 'airport', 'visa', 'passport'
    ],

    food: [
        'food', 'restaurant', 'chef', 'cuisine', 'recipe', 'nutrition',
        'diet', 'cooking', 'farming', 'agriculture'
    ],

    fashion: [
        'fashion', 'style', 'designer', 'brand', 'model', 'runway',
        'clothing', 'trend', 'luxury', 'retail'
    ],

    education: [
        'education', 'school', 'university', 'college', 'student', 'teacher',
        'graduation', 'degree', 'scholarship', 'exam', 'curriculum'
    ],

    // Weather & Disasters
    weather: [
        'weather', 'storm', 'hurricane', 'typhoon', 'tornado', 'flood',
        'drought', 'earthquake', 'tsunami', 'volcano', 'wildfire',
        'natural disaster', 'emergency', 'evacuation'
    ],

    // Transportation
    automotive: [
        'car', 'vehicle', 'electric vehicle', 'tesla', 'automotive',
        'driving', 'accident', 'traffic', 'fuel', 'engine'
    ],

    aviation: [
        'aviation', 'aircraft', 'airline', 'flight', 'pilot', 'airport',
        'boeing', 'airbus', 'crash', 'safety'
    ],

    // Energy
    energy: [
        'energy', 'oil', 'gas', 'petroleum', 'coal', 'nuclear',
        'renewable', 'solar', 'wind', 'hydroelectric', 'battery'
    ]
};

export {RSS_SOURCES, USER_AGENTS, DEFAULT_ENGAGEMENT_WEIGHTS};
