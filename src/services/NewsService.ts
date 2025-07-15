import "colors";
import axios from "axios";
import {apis} from "../utils/apis";
import {buildHeader} from "../utils/buildHeader";
import {TopHeadlinesAPIResponse, TopHeadlinesParams} from "../types/news";

// https://newsapi.org/docs/endpoints/top-headlines
const fetchTopHeadlines = async ({country, category, sources, q, pageSize, page}: TopHeadlinesParams) => {
    try {
        const {data: topHeadlinesResponse} = await axios.get<TopHeadlinesAPIResponse>(apis.topHeadlinesApi({country: country || 'us', category, sources, q, pageSize, page}), {headers: buildHeader()});
        console.log('topHeadlines:'.cyan.italic, topHeadlinesResponse);
        return topHeadlinesResponse;
    } catch (error: any) {
        console.error('ERROR: inside catch of fetchTopHeadlines:'.red.bold, error);
        throw error;
    }
}

export {fetchTopHeadlines};
