import {NEWSAPIORG_API_KEY} from "../config/config";

const buildHeader = (apiType: 'newsapi' | 'guardian' | 'nytimes' = 'newsapi') => {
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
    }

    return obj;
}

export {buildHeader};