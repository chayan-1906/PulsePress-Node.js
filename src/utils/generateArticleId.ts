import {createHash} from "crypto";
import {IGenerateArticleIdParams} from "../types/news";

const generateArticleId = ({url}: IGenerateArticleIdParams): string => {
    if (!url) {
        throw new Error('No valid URL found');
    }

    const data = url;
    return createHash('md5').update(data).digest('hex');
}

export {generateArticleId};
