import axios from "axios";
import Parser from "rss-parser";
import {RSSFeed} from "../types/news";
import {USER_AGENTS} from "./constants";

const parseRSS = async (rssFeedUrl: string): Promise<RSSFeed[]> => {
    let lastError;

    for (const userAgent of USER_AGENTS) {
        try {
            const response = await axios.get(rssFeedUrl, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
                    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://www.google.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'cross-site',
                    'Upgrade-Insecure-Requests': '1',
                    'Connection': 'keep-alive',
                },
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500, // Accept even 4xx errors to see what we get
            });

            // Check if we got blocked (some sites return HTML instead of XML when blocking)
            if (response.headers['content-type']?.includes('text/html')) {
                throw new Error('Received HTML instead of RSS (likely blocked)');
            }

            const parser = new Parser();
            const feed = await parser.parseString(response.data);

            const formattedFeed = feed.items.map(({creator, title, link, pubDate, contentSnippet, content, categories}) => ({
                source: {
                    name: feed.title?.trim().replace('\n', ''),
                    creator: creator?.trim(),
                },
                title: title?.trim(),
                url: link,
                publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
                content: content?.trim(),
                contentSnippet: contentSnippet?.trim(),
                categories: categories?.map(item => item.replace(/\n/g, '').trim()),
            }));

            return formattedFeed;
        } catch (error: any) {
            lastError = error;
            // Add small delay between retries to avoid rate limiting
            if (userAgent !== USER_AGENTS[USER_AGENTS.length - 1]) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    throw lastError;
}

export {parseRSS};
