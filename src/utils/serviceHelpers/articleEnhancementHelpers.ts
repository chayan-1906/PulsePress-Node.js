import "colors";
import {IArticle} from "../../types/news";
import {generateArticleId} from "../generateArticleId";
import ArticleEnhancementModel from "../../models/ArticleEnhancementSchema";
import {UpdateArticleIdsProcessingStatusParams, UpdateArticlesProcessingStatusParams} from "../../types/ai";

/**
 * Helper function to update processing status for multiple articles
 */
const updateArticlesProcessingStatus = async ({articles, status}: UpdateArticlesProcessingStatusParams): Promise<void> => {
    const articleIds = articles.map((article: IArticle) => generateArticleId({article}));
    for (const articleId of articleIds) {
        await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                url: articles.find(a => generateArticleId({article: a}) === articleId)?.url,
                processingStatus: status,
            },
            {upsert: true},
        );
    }
}

/**
 * Helper function to update processing status for multiple article IDs
 */
const updateArticleIdsProcessingStatus = async ({articleIds, status}: UpdateArticleIdsProcessingStatusParams): Promise<void> => {
    for (const articleId of articleIds) {
        await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {processingStatus: status},
            {upsert: true},
        );
    }
}

export {updateArticlesProcessingStatus, updateArticleIdsProcessingStatus};
