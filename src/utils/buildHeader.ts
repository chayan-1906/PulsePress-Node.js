import {HUGGINGFACE_API_TOKEN, NEWSAPIORG_API_KEY} from "../config/config";

const buildHeader = (apiType: 'newsapi' | 'guardian' | 'nytimes' | 'huggingface' | 'webscraping' | 'internal' | 'rss' = 'newsapi', userAgent?: string) => {
    const obj = {
        'Content-Type': 'application/json',
        'Charset': 'UTF-8',
        'User-Agent': 'PulsePress/1.0',
    } as any;

    switch (apiType) {
        case 'newsapi':
            if (NEWSAPIORG_API_KEY) {
                obj['X-Api-Key'] = NEWSAPIORG_API_KEY;
            }
            break;
        case 'guardian':
            // Guardian API key is passed as query parameter, not header
            break;
        case 'nytimes':
            // NYTimes API key is passed as query parameter, not header
            break;
        case 'huggingface':
            if (HUGGINGFACE_API_TOKEN) {
                obj['Authorization'] = `Bearer ${HUGGINGFACE_API_TOKEN}`;
            }
            break;
        case 'webscraping':
            if (userAgent) {
                obj['User-Agent'] = userAgent;
            }
            obj['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
            obj['Accept-Language'] = 'en-US,en;q=0.5';
            obj['Accept-Encoding'] = 'gzip, deflate';
            obj['Referer'] = 'https://www.google.com/';
            break;
        case 'internal':
            // Internal API calls only need Content-Type (already set in base obj)
            break;
        case 'rss':
            if (userAgent) {
                obj['User-Agent'] = userAgent;
            }
            obj['Accept'] = 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*';
            obj['Accept-Language'] = 'en-US,en;q=0.9,bn;q=0.8';
            obj['Accept-Encoding'] = 'gzip, deflate, br';
            obj['Cache-Control'] = 'no-cache';
            obj['Pragma'] = 'no-cache';
            obj['Referer'] = 'https://www.google.com/';
            obj['Sec-Fetch-Dest'] = 'document';
            obj['Sec-Fetch-Mode'] = 'navigate';
            obj['Sec-Fetch-Site'] = 'cross-site';
            obj['Upgrade-Insecure-Requests'] = '1';
            obj['Connection'] = 'keep-alive';
            break;
    }

    return obj;
}

export {buildHeader};
