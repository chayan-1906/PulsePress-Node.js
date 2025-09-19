import "colors";
import {IArticle} from "../../types/news";
import {CONTENT_LIMITS} from "../constants";
import {generateArticleId} from "../generateArticleId";
import ArticleEnhancementModel from "../../models/ArticleEnhancementSchema";
import CachedQuestionAnswerModel from "../../models/CachedQuestionAnswerSchema";
import CachedSummaryModel, {ICachedSummary} from "../../models/CachedSummarySchema";
import CachedArticleEnhancementModel, {ICachedArticleEnhancement} from "../../models/CachedArticleEnhancementSchema";
import {IBasicEnhancementsParams, IUpdateArticleIdsProcessingStatusParams, IUpdateArticlesProcessingStatusParams, TBasicEnhancementTypes} from "../../types/ai";

/**
 * Cache generated questions
 */
const cacheQuestions = async (contentHash: string, questions: string[]): Promise<void> => {
    console.log('Service: cacheQuestions called'.cyan.italic, {contentHash, questions});

    try {
        await CachedQuestionAnswerModel.findOneAndUpdate(
            {contentHash},
            {
                $set: {questions},
                $setOnInsert: {
                    createdAt: new Date(),
                    answers: new Map(),
                },
            },
            {upsert: true, new: true},
        );
        console.log('Cache: Questions cached successfully'.cyan);
    } catch (error) {
        console.error('Service Error: Failed to cache questions:'.red.bold, error);
    }
}

/**
 * Cache generated answer
 */
const cacheAnswer = async (contentHash: string, question: string, answer: string): Promise<void> => {
    console.log('Service: cacheAnswer called'.cyan.italic, {contentHash, question, answer});

    try {
        await CachedQuestionAnswerModel.findOneAndUpdate(
            {contentHash},
            {
                $set: {
                    [`answers.${question}`]: answer,
                },
                $setOnInsert: {
                    createdAt: new Date(),
                    questions: [],
                },
            },
            {upsert: true, new: true},
        );
        console.log('Cache: Answer cached successfully'.cyan);
    } catch (error) {
        console.error('Service Error: Failed to cache answer:'.red.bold, error);
    }
}

/**
 * Save generated summary to cache with content hash and metadata
 */
const saveSummaryToCache = async (contentHash: string, summary: string, language: string, style: string): Promise<ICachedSummary | null> => {
    console.log('Service: saveSummaryToCache called'.cyan.italic, {contentHash, summary: summary.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...', language, style});

    try {
        /*if (NODE_ENV !== 'production') {
            console.log('Caching disabled in development mode'.cyan);
            return null;
        }*/

        const savedContentHash: ICachedSummary | null = await CachedSummaryModel.create({contentHash, summary, language, style});
        console.log('Saved content hash to cache:'.cyan, savedContentHash);
        return savedContentHash;
    } catch (error: any) {
        console.error('Service Error: saveSummaryToCache failed'.red.bold, error);
        throw error;
    }
}

/**
 * Retrieve cached summary by content hash
 */
const getCachedSummary = async (contentHash: string): Promise<ICachedSummary | null> => {
    console.log('Service: getCachedSummary called'.cyan.italic, {contentHash});

    try {
        /*if (NODE_ENV !== 'production') {
            console.log('Caching disabled in development mode'.cyan);
            return null;
        }*/

        const cachedSummary: ICachedSummary | null = await CachedSummaryModel.findOne({contentHash});
        console.log('Retrieved cached summary:'.cyan, cachedSummary ? 'Found' : 'Not found');
        return cachedSummary;
    } catch (error: any) {
        console.error('Service Error: getCachedSummary failed'.red.bold, error);
        return null;
    }
}

/**
 * Helper function to update processing status for multiple articles
 */
const updateArticlesProcessingStatus = async ({articles, status}: IUpdateArticlesProcessingStatusParams): Promise<void> => {
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
const updateArticleIdsProcessingStatus = async ({articleIds, status}: IUpdateArticleIdsProcessingStatusParams): Promise<void> => {
    for (const articleId of articleIds) {
        await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {processingStatus: status},
            {upsert: true},
        );
    }
}

/**
 * Get cached article enhancements by content hash
 */
const getCachedArticleEnhancements = async (contentHash: string): Promise<ICachedArticleEnhancement | null> => {
    console.log('Service: getCachedArticleEnhancements called'.cyan.italic, {contentHash});

    try {
        const cachedEnhancements = await CachedArticleEnhancementModel.findOne({contentHash});
        console.log('Cache lookup result:'.cyan, cachedEnhancements ? 'Found' : 'Not found');
        return cachedEnhancements;
    } catch (error: any) {
        console.error('Service Error: getCachedArticleEnhancements failed'.red.bold, error);
        return null;
    }
}

/**
 * Save or update basic article enhancements (from /multi-source/enhance)
 */
const saveBasicEnhancements = async (contentHash: string, enhancements: IBasicEnhancementsParams): Promise<ICachedArticleEnhancement | null> => {
    console.log('Service: saveBasicEnhancements called'.cyan.italic, {contentHash, enhancementTypes: Object.keys(enhancements)});

    try {
        const updateData: Partial<ICachedArticleEnhancement> = {};

        if (enhancements.tags) updateData.tags = enhancements.tags;
        if (enhancements.sentiment) updateData.sentiment = enhancements.sentiment;
        if (enhancements.keyPoints) updateData.keyPoints = enhancements.keyPoints;
        if (enhancements.complexityMeter) updateData.complexityMeter = enhancements.complexityMeter;
        if (enhancements.locations) updateData.locations = enhancements.locations;

        const savedEnhancements: ICachedArticleEnhancement = await CachedArticleEnhancementModel.findOneAndUpdate(
            {contentHash},
            {
                $set: updateData,
                $setOnInsert: {
                    contentHash,
                    createdAt: new Date(),
                },
            },
            {upsert: true, new: true},
        );

        console.log('Basic enhancements cached successfully'.cyan, {contentHash, fieldsUpdated: Object.keys(updateData)});

        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveBasicEnhancements failed'.red.bold, error);
        return null;
    }
}

/**
 * Check if specific enhancement types are already cached
 */
const hasEnhancementTypes = async (contentHash: string, enhancementTypes: TBasicEnhancementTypes[]): Promise<{ [key: string]: boolean }> => {
    console.log('Service: hasEnhancementTypes called'.cyan.italic, {contentHash, enhancementTypes});

    try {
        const cached = await CachedArticleEnhancementModel.findOne({contentHash});

        if (!cached) {
            return enhancementTypes.reduce((acc, type) => ({...acc, [type]: false}), {});
        }

        const result: { [key: string]: boolean } = {};
        enhancementTypes.forEach(type => {
            result[type] = cached[type] !== undefined && cached[type] !== null;
        });

        console.log('Enhancement availability check:'.cyan, result);
        return result;
    } catch (error: any) {
        console.error('Service Error: hasEnhancementTypes failed'.red.bold, error);
        return enhancementTypes.reduce((acc, type) => ({...acc, [type]: false}), {});
    }
}

export {
    cacheQuestions,
    cacheAnswer,
    saveSummaryToCache,
    getCachedSummary,
    updateArticlesProcessingStatus,
    updateArticleIdsProcessingStatus,
    getCachedArticleEnhancements,
    saveBasicEnhancements,
    hasEnhancementTypes,
};
