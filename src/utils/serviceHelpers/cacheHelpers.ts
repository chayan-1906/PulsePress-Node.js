import "colors";
import {IArticle} from "../../types/news";
import {CONTENT_LIMITS} from "../constants";
import {generateArticleId} from "../generateArticleId";
import CachedQuestionAnswerModel from "../../models/CachedQuestionAnswerSchema";
import ArticleEnhancementModel, {IArticleEnhancement} from "../../models/ArticleEnhancementSchema";
import {
    IBasicEnhancementsParams,
    IGetCachedCaptionVariationParams,
    IGetCachedCaptionVariationResponse,
    IGetCachedSummaryVariationParams,
    IGetCachedSummaryVariationResponse,
    ISaveCaptionVariationParams,
    ISaveSummaryVariationParams,
    IUpdateArticleIdsProcessingStatusParams,
    IUpdateArticlesProcessingStatusParams,
    TBasicEnhancementTypes,
    TSocialMediaCaptionStyle,
    TSocialMediaPlatform,
    TSummarizationStyle,
    TSupportedLanguage,
} from "../../types/ai";

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
 * Helper function to update processing status for multiple articles
 */
const updateArticlesProcessingStatus = async ({articles, status}: IUpdateArticlesProcessingStatusParams): Promise<void> => {
    const articleIds = articles.map((article: IArticle) => generateArticleId({url: article.url}));
    for (const articleId of articleIds) {
        await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                url: articles.find((article: IArticle) => generateArticleId({url: article.url}) === articleId)?.url,
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
 * Get cached article enhancements by article ID
 */
const getCachedArticleEnhancements = async (articleId: string): Promise<IArticleEnhancement | null> => {
    console.log('Service: getCachedArticleEnhancements called'.cyan.italic, {articleId});

    try {
        const cachedEnhancements = await ArticleEnhancementModel.findOne({articleId});
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
const saveBasicEnhancements = async (enhancements: IBasicEnhancementsParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveBasicEnhancements called'.cyan.italic, {articleId: enhancements.articleId, enhancementTypes: Object.keys(enhancements)});

    try {
        const updateData: Partial<IArticleEnhancement> = {};

        if (enhancements.tags && enhancements.tags.length > 0) updateData.tags = enhancements.tags;
        if (enhancements.sentiment && Object.keys(enhancements.sentiment).length > 0) updateData.sentiment = enhancements.sentiment;
        if (enhancements.keyPoints && enhancements.keyPoints.length > 0) updateData.keyPoints = enhancements.keyPoints;
        if (enhancements.complexityMeter && Object.keys(enhancements.complexityMeter).length > 0) updateData.complexityMeter = enhancements.complexityMeter;
        if (enhancements.locations && enhancements.locations.length > 0) updateData.locations = enhancements.locations;

        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId: enhancements.articleId},
            {
                $set: updateData,
                $setOnInsert: {
                    articleId: enhancements.articleId,
                    url: enhancements.url,
                    processingStatus: 'completed',
                    createdAt: new Date(),
                },
            },
            {upsert: true, new: true, minimize: true},
        );

        console.log('Basic enhancements cached successfully'.cyan, {articleId: enhancements.articleId, fieldsUpdated: Object.keys(updateData)});

        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveBasicEnhancements failed'.red.bold, error);
        return null;
    }
}

/**
 * Check if specific enhancement types are already cached
 */
const hasEnhancementTypes = async (articleId: string, enhancementTypes: TBasicEnhancementTypes[]): Promise<{ [key: string]: boolean }> => {
    console.log('Service: hasEnhancementTypes called'.cyan.italic, {articleId, enhancementTypes});

    try {
        const cached = await ArticleEnhancementModel.findOne({articleId});

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

/**
 * Generate composite key for summary variations (style + language)
 */
const generateSummaryKey = (style: TSummarizationStyle, language: TSupportedLanguage): string => `${style}+${language}`;

/**
 * Save summary variation to nested Map structure
 */
const saveSummaryVariation = async ({articleId, summary, url, style, language}: ISaveSummaryVariationParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveSummaryVariation called'.cyan.italic, {articleId, style, language, summary: summary.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...'});

    try {
        const summaryKey = generateSummaryKey(style, language);
        const summaryData = {
            content: summary,
            style,
            language,
            createdAt: new Date(),
        };

        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                $set: {
                    [`summaries.${summaryKey}`]: summaryData,
                },
                $setOnInsert: {
                    articleId,
                    url,
                    processingStatus: 'completed',
                    createdAt: new Date(),
                },
            },
            {upsert: true, new: true},
        );

        console.log('Summary variation cached successfully'.cyan, {articleId, summaryKey});
        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveSummaryVariation failed'.red.bold, error);
        return null;
    }
}

/**
 * Get cached summary variation by style and language
 */
const getCachedSummaryVariation = async ({articleId, style, language}: IGetCachedSummaryVariationParams): Promise<IGetCachedSummaryVariationResponse | null> => {
    console.log('Service: getCachedSummaryVariation called'.cyan.italic, {articleId, style, language});

    try {
        const summaryKey = generateSummaryKey(style, language);
        const cached = await ArticleEnhancementModel.findOne({articleId});

        if (!cached || !cached.summaries) {
            console.log('Cache lookup result:'.cyan, 'Not found');
            return null;
        }

        const summaryVariation = cached.summaries.get(summaryKey);
        console.log('Summary variation lookup result:'.cyan, summaryVariation ? 'Found' : 'Not found', {summaryKey});

        return summaryVariation || null;
    } catch (error: any) {
        console.error('Service Error: getCachedSummaryVariation failed'.red.bold, error);
        return null;
    }
}

/**
 * Generate composite key for social media caption variations
 */
const generateCaptionKey = (style: TSocialMediaCaptionStyle, platform?: TSocialMediaPlatform): string => platform ? `${style}+${platform}` : style;

/**
 * Save social media caption variation to nested Map structure
 */
const saveCaptionVariation = async ({articleId, caption, url, style, platform}: ISaveCaptionVariationParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveCaptionVariation called'.cyan.italic, {articleId, style, platform, caption: caption.substring(0, 100) + '...'});

    try {
        const captionKey = generateCaptionKey(style, platform);
        const captionData = {
            content: caption,
            style,
            platform,
            createdAt: new Date(),
        };

        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                $set: {
                    [`socialMediaCaptions.${captionKey}`]: captionData,
                },
                $setOnInsert: {
                    articleId,
                    url,
                    processingStatus: 'completed',
                    createdAt: new Date(),
                },
            },
            {upsert: true, new: true},
        );

        console.log('Caption variation cached successfully'.cyan, {articleId, captionKey});
        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveCaptionVariation failed'.red.bold, error);
        return null;
    }
}

/**
 * Get cached social media caption variation by style and platform
 */
const getCachedCaptionVariation = async ({articleId, style, platform}: IGetCachedCaptionVariationParams): Promise<IGetCachedCaptionVariationResponse | null> => {
    console.log('Service: getCachedCaptionVariation called'.cyan.italic, {articleId, style, platform});

    try {
        const captionKey = generateCaptionKey(style, platform);
        const cached = await ArticleEnhancementModel.findOne({articleId});

        if (!cached || !cached.socialMediaCaptions) {
            console.log('Cache lookup result:'.cyan, 'Not found');
            return null;
        }

        const captionVariation = cached.socialMediaCaptions.get(captionKey);
        console.log('Caption variation lookup result:'.cyan, captionVariation ? 'Found' : 'Not found', {captionKey});

        return captionVariation || null;
    } catch (error: any) {
        console.error('Service Error: getCachedCaptionVariation failed'.red.bold, error);
        return null;
    }
}

export {
    cacheQuestions,
    cacheAnswer,
    updateArticlesProcessingStatus,
    updateArticleIdsProcessingStatus,
    getCachedArticleEnhancements,
    saveBasicEnhancements,
    hasEnhancementTypes,
    saveSummaryVariation,
    saveCaptionVariation,
    getCachedSummaryVariation,
    getCachedCaptionVariation,
};
