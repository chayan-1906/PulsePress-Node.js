import Parser from "rss-parser";
import {RSSFeed} from "../types/news";

const parseRSS = async (rssFeedUrl: string): Promise<RSSFeed[]> => {
    const parser = new Parser();
    const feed = await parser.parseURL(rssFeedUrl);

    const formattedFeed = feed.items.map(({creator, title, link, pubDate, contentSnippet, content, categories}) => ({
        source: {
            name: feed.title?.trim().replace('\n', ''),
            creator: creator?.trim(),
        },
        title: title?.trim(),
        url: link,
        publishedAt: pubDate,
        content: content?.trim(),
        contentSnippet: contentSnippet?.trim(),
        categories,
    }));
    // console.log('formattedFeed:', formattedFeed);
    return formattedFeed;
}

// parseRSS('https://feeds.arstechnica.com/arstechnica/index');

export {parseRSS};
