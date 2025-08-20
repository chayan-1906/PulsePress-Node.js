import {createHash} from "crypto";
import {GenerateArticleIdParams} from "../types/news";

const generateArticleId = ({article, title, url}: GenerateArticleIdParams): string => {
    const finalUrl = url || article?.url;
    const finalTitle = title || article?.title;

    if (!finalUrl) {
        throw new Error('No valid URL found');
    }
    if (!finalTitle) {
        throw new Error('No valid title found');
    }

    const data = `${finalUrl}-${finalTitle}`;
    return createHash('md5').update(data).digest('hex');
}

export {generateArticleId};
