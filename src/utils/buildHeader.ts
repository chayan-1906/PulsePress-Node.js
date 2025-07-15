import {NEWSAPIORG_API_KEY} from "../config/config";

const buildHeader = () => {
    const obj = {
        'Content-Type': 'application/json',
        'Charset': 'UTF-8',
    } as any;

    if (NEWSAPIORG_API_KEY) {
        obj['X-Api-Key'] = NEWSAPIORG_API_KEY;
    }

    return obj;
}

export {buildHeader};
