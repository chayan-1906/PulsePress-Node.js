import "colors";
import axios from "axios";
import {apis} from "../utils/apis";
import {parseRSS} from "../utils/parseRSS";
import {RSS_SOURCES} from "../utils/constants";
import {buildHeader} from "../utils/buildHeader";
import {RSSFeed, RSSFeedParams, SUPPORTED_NEWS_LANGUAGES, TopHeadlinesAPIResponse, TopHeadlinesParams} from "../types/news";

// https://newsapi.org/docs/endpoints/top-headlines
const fetchTopHeadlines = async ({country, category, sources, q, pageSize = 10, page = 1}: TopHeadlinesParams) => {
    try {
        const {data: topHeadlinesResponse} = await axios.get<TopHeadlinesAPIResponse>(apis.topHeadlinesApi({country: country || 'us', category, sources, q, pageSize, page}), {headers: buildHeader()});
        console.log('topHeadlines:'.cyan.italic, topHeadlinesResponse);

        // fallback → fetch RSS feeds
        if (topHeadlinesResponse.articles.length === 0) {
            return await fetchRSSFeed({});
        }
        return topHeadlinesResponse;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchTopHeadlines:'.red.bold, error);

        // fallback → fetch RSS feeds
        return await fetchRSSFeed({});
    }
}

const fetchRSSFeed = async ({sources, languages = 'english', pageSize = 10, page = 1}: RSSFeedParams) => {
    try {
        const languageList = languages
            ? languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
            : [];

        const validLanguages = languageList.filter(lang => SUPPORTED_NEWS_LANGUAGES.includes(lang));
        const languagesToFetch = validLanguages.length ? validLanguages : ['english'];

        let inputSources: string[] = [];

        if (sources) {
            inputSources = sources.split(',').map(s => s.trim()).filter(Boolean);
        }

        const seenURLs = new Set<string>();
        const promises: Promise<any>[] = [];

        languagesToFetch.forEach(language => {
            const languageSources = RSS_SOURCES[language as keyof typeof RSS_SOURCES];
            const availableSources = Object.keys(languageSources);

            const selectedSources = inputSources.length
                ? inputSources.filter(src => src in languageSources)
                : [...availableSources].sort(() => Math.random() - 0.5);

            selectedSources.forEach(source => {
                const url = languageSources[source as keyof typeof languageSources];
                if (url && !seenURLs.has(url)) {
                    seenURLs.add(url);
                    promises.push(parseRSS(url).catch(() => null));
                }
            });
        });

        const results = await Promise.allSettled(promises);
        const allItems = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .flatMap(r => (r as PromiseFulfilledResult<RSSFeed[]>).value)
            .sort(() => Math.random() - 0.5); // shuffle results

        const startIndex = (page - 1) * pageSize;
        return allItems.slice(startIndex, startIndex + pageSize);
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchRSSFeed:'.red.bold, error);
        throw error;
    }
}

export {fetchTopHeadlines, fetchRSSFeed};
