import "colors";
import {generateArticleId} from "../generateArticleId";
import {IArticle, IGuardianArticle, INewYorkTimesArticle, INewYorkTimesTopStoriesResponse, IRssFeed} from "../../types/news";
import {IArticleEnhancement} from "../../models/ArticleEnhancementSchema";

/**
 * Convert Guardian API response to standardized article format
 */
export const convertGuardianToArticle = (guardianArticle: IGuardianArticle): IArticle => {
    console.log('Service: convertGuardianToArticle called'.cyan.italic, {guardianArticle});

    const title = guardianArticle.fields?.headline || guardianArticle.webTitle;
    const url = guardianArticle.webUrl;
    const article: IArticle = {
        source: {
            id: 'guardian',
            name: 'The Guardian',
        },
        author: guardianArticle.fields?.byline || null,
        articleId: generateArticleId({url}),
        title,
        description: guardianArticle.fields?.bodyText?.substring(0, 100) + '...' || null,
        url,
        urlToImage: guardianArticle.fields?.thumbnail || null,
        publishedAt: guardianArticle.webPublicationDate,
        content: guardianArticle.fields?.bodyText?.substring(0, 100) + '...' || null,
    };
    console.log('convertGuardianToArticle:'.cyan, article);
    return article;
}

/**
 * Convert NY Times search API response to standardized article format
 */
export const convertNewYorkTimesToArticle = (nytArticle: INewYorkTimesArticle): IArticle => {
    console.log('Service: convertNewYorkTimesToArticle called'.cyan.italic, {nytArticle});

    const title = nytArticle.headline?.main;
    const url = nytArticle.web_url;
    const article: IArticle = {
        source: {
            id: 'nytimes',
            name: 'The New York Times',
        },
        author: nytArticle.byline?.original || null,
        articleId: generateArticleId({url}),
        title,
        description: nytArticle.abstract || nytArticle.snippet || null,
        url,
        urlToImage: nytArticle.multimedia?.[0]?.url ? `https://static01.nyt.com/${nytArticle.multimedia[0].url}` : null,
        publishedAt: nytArticle.pub_date,
        content: nytArticle.lead_paragraph?.substring(0, 100) + '...' || null,
    };
    console.log('convertNewYorkTimesToArticle:'.cyan, article);
    return article;
}

/**
 * Convert NY Times top stories API response to standardized article format
 */
export const convertNewYorkTimesTopStoryToArticle = (story: INewYorkTimesTopStoriesResponse['results'][0]): IArticle => {
    console.log('Service: convertNewYorkTimesTopStoryToArticle called'.cyan.italic, {story});

    const title = story.title;
    const url = story.url;
    const article: IArticle = {
        source: {
            id: 'nytimes',
            name: 'The New York Times',
        },
        author: story.byline,
        articleId: generateArticleId({url}),
        title,
        description: story.abstract,
        url,
        urlToImage: story.multimedia?.[0]?.url || null,
        publishedAt: story.published_date,
        content: story.abstract?.substring(0, 100) + '...' || null,
    };
    console.log('convertNewYorkTimesTopStoryToArticle:'.cyan, article);
    return article;
}

/**
 * Convert RSS feed item to standardized article format
 */
export const convertRSSFeedToArticle = (rss: IRssFeed): IArticle => {
    console.log('Service: convertRSSFeedToArticle called'.cyan.italic, {rss});

    const title = rss.title || '';
    const url = rss.url || '';
    const article: IArticle = {
        source: {
            id: null,
            name: rss.source?.name || 'RSS Feed',
        },
        author: rss.source?.creator || null,
        articleId: generateArticleId({url}),
        title,
        description: rss.contentSnippet || null,
        url,
        urlToImage: null,
        publishedAt: rss.publishedAt || null,
        content: rss.content?.substring(0, 100) + '...' || null,
    };
    console.log('convertRSSFeedToArticle:'.cyan, article);
    return article;
}

/**
 * Merge enhancement data with original articles
 */
export const mergeEnhancementsWithArticles = (articles: IArticle[], enhancements: { [articleId: string]: IArticleEnhancement }): IArticle[] => {
    return articles.map(article => {
        const articleId = generateArticleId({url: article.url});
        const enhancement = enhancements[articleId];

        if (enhancement) {
            return {
                ...article,
                tags: enhancement.tags,
                sentimentData: enhancement.sentiment,
                keyPoints: enhancement.keyPoints,
                complexityMeter: enhancement.complexityMeter,
                locations: enhancement.locations,
                complexity: enhancement.complexity,
                processingStatus: enhancement.processingStatus,
                enhanced: enhancement.processingStatus === 'completed',
            };
        }

        return {...article, enhanced: false};
    });
}
