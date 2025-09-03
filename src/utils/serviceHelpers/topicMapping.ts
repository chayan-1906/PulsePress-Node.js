import "colors";
import {TOPIC_SPECIFIC_SOURCES} from "../constants";

/**
 * Determine news topic/category from query text or explicit category
 */
export const determineTopicFromQuery = (query?: string, category?: string): string => {
    console.log('Service: determineTopicFromQuery called'.cyan.italic, {query, category});

    if (category) return category;

    if (!query) return 'general';

    const lowerQuery = query.toLowerCase();

    // Legacy fallback detection
    if (/sport|match|game|team|player|football|basketball|tennis|nba|cricket|soccer|olympics|athlete/i.test(lowerQuery)) return 'sports';
    if (/business|economy|market|finance|stock|trade|company|earnings|revenue|merger|ipo|startup/i.test(lowerQuery)) return 'business';
    if (/tech|technology|ai|software|digital|cyber|internet|app|gadget|robot|innovation |device/i.test(lowerQuery)) return 'technology';
    if (/health|medical|medicine|disease|treatment|doctor|covid|vaccine|hospital|mental |wellness|fitness|nutrition/i.test(lowerQuery)) return 'health';
    if (/science|research|study|climate|environment|space|nasa|discovery|biology|physics|astronomy|experiment/i.test(lowerQuery)) return 'science';
    if (/politics|government|election|policy|parliament|law|minister|president|senate|congress|diplomacy|campaign/i.test(lowerQuery)) return 'politics';
    if (/entertainment|movie|film|music|celebrity|actor|actress|hollywood|bollywood|show|tv|series|drama/i.test(lowerQuery)) return 'entertainment';
    if (/crime|arrest|police|court|trial|murder|investigation|lawsuit|theft|fraud|scam|homicide/i.test(lowerQuery)) return 'crime';
    if (/travel|tourism|flight|hotel|vacation|airline|destination|trip|journey|passport |visa/i.test(lowerQuery)) return 'travel';
    if (/education|school|university|college|student|exam|curriculum|learning|degree|tuition/i.test(lowerQuery)) return 'education';
    if (/weather|storm|rain|snow|heatwave|hurricane|flood|temperature|forecast/i.test(lowerQuery)) return 'weather';
    if (/auto|car|vehicle|automobile|ev|electric.vehicle|motor|tesla|ford|bmw|transport/i.test(lowerQuery)) return 'automotive';

    return 'general';
}

/**
 * Convert domain names to NewsAPI-compatible source format
 */
export const convertDomainToNewsAPIFormat = (sources: string): string => {
    console.log('Service: convertDomainToNewsAPIFormat called'.cyan.italic, {sources});

    const sourceMap: Record<string, string> = {
        // Business
        'bloomberg': 'bloomberg.com',
        'financial-times': 'financial-times.com',
        'wall-street-journal': 'the-wall-street-journal.com',
        'cnbc': 'cnbc.com',
        'business-insider': 'business-insider.com',
        'marketwatch': 'marketwatch.com',
        'fortune': 'fortune.com',
        'forbes': 'forbes.com',

        // Technology
        'techcrunch': 'techcrunch.com',
        'ars-technica': 'ars-technica.com',
        'the-verge': 'the-verge.com',
        'wired': 'wired.com',
        'engadget': 'engadget.com',
        'cnet': 'cnet.com',
        'zdnet': 'zdnet.com',
        'mashable': 'mashable.com',
        'gizmodo': 'gizmodo.com',
        'techradar': 'techradar.com',
        'recode': 'recode.net',
        'hacker-news': 'hacker-news.com',

        // Sports
        'espn': 'espn.com',
        'bbc-sport': 'bbc.co.uk',
        'sky-sports': 'sky-sports.com',
        'the-sport-bible': 'the-sport-bible.com',
        'talksport': 'talksport.com',
        'sporting-news': 'sporting-news.com',
        'sportsnet': 'sportsnet.ca',

        // General News
        'bbc-news': 'bbc.co.uk',
        'cnn': 'cnn.com',
        'reuters': 'reuters.com',
        'associated-press': 'associated-press.com',
        'al-jazeera': 'al-jazeera-english.com',
        'sky-news': 'sky-news.com',
        'washington-post': 'the-washington-post.com',
        'nytimes': 'the-new-york-times.com',
        'politico': 'politico.com',
        'the-hill': 'the-hill.com',
        'axios': 'axios.com',
        'usa-today': 'usa-today.com'
    };

    return sources.split(',').map(source => sourceMap[source.trim()] || source.trim()).join(',');
}

/**
 * Get topic-specific news sources or convert user-provided sources
 */
export const getOptimizedSourcesForTopic = (topic: string, userSources?: string): string | undefined => {
    console.log('Service: getOptimizedSourcesForTopic called'.cyan.italic, {topic, userSources});

    if (userSources) return convertDomainToNewsAPIFormat(userSources);

    const topicSources = TOPIC_SPECIFIC_SOURCES[topic as keyof typeof TOPIC_SPECIFIC_SOURCES];
    return topicSources ? convertDomainToNewsAPIFormat(topicSources.join(',')) : undefined;
}

/**
 * Map topic to NY Times API section parameter
 */
export const mapToNewYorkTimesSection = (topic: string): string => {
    console.log('Service: mapToNewYorkTimesSection called'.cyan.italic, {topic});

    const sectionMap: Record<string, string> = {
        sports: 'sports',
        business: 'business',
        technology: 'technology',
        health: 'health',
        science: 'science',
        politics: 'politics',
        general: 'home',
    };

    return sectionMap[topic] || 'home';
}
