import axios from "axios";
import Parser from "rss-parser";
import {IRssFeed} from "../types/news";
import {USER_AGENTS} from "./constants";
import {buildHeader} from "./buildHeader";

/**
 * Fix malformed XML by escaping unescaped ampersands and other common issues
 */
const sanitizeXML = (xmlString: string): string => {
    let sanitized = xmlString.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');

    if (sanitized.includes('<channel>') && !sanitized.includes('<rss')) {
        const xmlDeclMatch = sanitized.match(/^<\?xml[^>]*\?>\s*/);
        const xmlDecl = xmlDeclMatch ? xmlDeclMatch[0] : '';
        const content = xmlDeclMatch ? sanitized.substring(xmlDeclMatch[0].length) : sanitized;

        sanitized = `${xmlDecl}<rss version="2.0">${content}</rss>`;
    }

    return sanitized;
}

const parseRSS = async (rssFeedUrl: string): Promise<IRssFeed[]> => {
    let lastError;

    for (const userAgent of USER_AGENTS) {
        try {
            const response = await axios.get(rssFeedUrl, {
                headers: buildHeader('rss', userAgent),
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500, // Accept even 4xx errors to see what we get
            });

            // Check if we got blocked (some sites return HTML instead of XML when blocking)
            if (response.headers['content-type']?.includes('text/html')) {
                throw new Error('Received HTML instead of RSS (likely blocked)');
            }

            const sanitizedXML = sanitizeXML(response.data);

            const parser = new Parser();
            const feed = await parser.parseString(sanitizedXML);

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
                categories: categories?.map(item => {
                    if (typeof item === 'string') {
                        return item.replace(/\n/g, '').trim();
                    } else if (item && typeof item === 'object') {
                        // For RSS feeds, categories might be objects with _ property
                        const objItem = item as any;
                        return (objItem._ || objItem.name || String(item)).replace(/\n/g, '').trim();
                    }
                    return String(item).replace(/\n/g, '').trim();
                }).filter(Boolean),
            }));

            return formattedFeed;
        } catch (error: any) {
            lastError = error;
            if (userAgent !== USER_AGENTS[USER_AGENTS.length - 1]) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    throw lastError;
}

export {parseRSS};
