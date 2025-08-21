import {HUGGINGFACE_API_TOKEN, NEWSAPIORG_API_KEY} from "../config/config";

const buildHeader = (apiType: 'newsapi' | 'guardian' | 'nytimes' | 'huggingface' = 'newsapi') => {
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
    }

    return obj;
}

export {buildHeader};
