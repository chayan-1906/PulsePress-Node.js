import "colors";
import axios from "axios";
import {apis} from "../utils/apis";
import {parseRSS} from "../utils/parseRSS";
import {RSS_SOURCES} from "../utils/constants";
import {buildHeader} from "../utils/buildHeader";
import {RSSFeed, RSSFeedParams, TopHeadlinesAPIResponse, TopHeadlinesParams} from "../types/news";

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

const fetchRSSFeed = async ({sources, language = 'english', pageSize = 10, page = 1}: RSSFeedParams) => {
    try {
        const languageSources = RSS_SOURCES[language as keyof typeof RSS_SOURCES] || RSS_SOURCES.english;
        const allSources = Object.keys(languageSources);

        let sourcesToFetch: string[];

        if (sources) {
            sourcesToFetch = sources.split(',');
        } else {
            const shuffled = [...allSources].sort(() => Math.random() - 0.5);
            sourcesToFetch = shuffled.slice(0, pageSize);
        }

        const promises = sourcesToFetch.map(source => {
            const url = languageSources[source as keyof typeof languageSources];
            return url ? parseRSS(url).catch(() => null) : Promise.resolve(null);
        });

        const results = await Promise.allSettled(promises);
        const allItems = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .flatMap(r => (r as PromiseFulfilledResult<RSSFeed[]>).value)
            .sort(() => Math.random() - 0.5);

        const startIndex = (page - 1) * pageSize;
        return allItems.slice(startIndex, startIndex + pageSize);
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchRSSFeed:'.red.bold, error);
        throw error;
    }
}

export {fetchTopHeadlines, fetchRSSFeed};
