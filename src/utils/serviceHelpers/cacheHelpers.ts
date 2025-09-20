import "colors";
import {IArticle} from "../../types/news";
import {CONTENT_LIMITS} from "../constants";
import {generateContentHash} from "./contentHashing";
import {generateArticleId} from "../generateArticleId";
import ArticleEnhancementModel, {IArticleEnhancement} from "../../models/ArticleEnhancementSchema";
import {
    IBasicEnhancementsParams,
    IGetCachedCaptionVariationParams,
    IGetCachedCaptionVariationResponse,
    IGetCachedNewsInsightsParams,
    IGetCachedQuestionAnswerParams,
    IGetCachedQuestionsParams,
    IGetCachedSummaryVariationParams,
    IGetCachedSummaryVariationResponse,
    ISaveCaptionVariationParams,
    ISaveNewsInsightsParams,
    ISaveQuestionAnswerParams,
    ISaveQuestionsParams,
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

/**
 * Generate key for question-answer caching (hash of question for consistent key)
 */
const generateQuestionKey = (question: string): string => generateContentHash(question);

/**
 * Save questions to cache
 */
const saveQuestions = async ({articleId, url, questions}: ISaveQuestionsParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveQuestions called'.cyan.italic, {articleId, questionsCount: questions.length});

    try {
        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                $set: {
                    questions,
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

        console.log('Questions cached successfully'.cyan, {articleId, questionsCount: questions.length});
        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveQuestions failed'.red.bold, error);
        return null;
    }
}

/**
 * Get cached questions
 */
const getCachedQuestions = async ({articleId}: IGetCachedQuestionsParams): Promise<string[] | null> => {
    console.log('Service: getCachedQuestions called'.cyan.italic, {articleId});

    try {
        const cached = await ArticleEnhancementModel.findOne({articleId});

        if (!cached || !cached.questions || cached.questions.length === 0) {
            console.log('Cache lookup result:'.cyan, 'Not found');
            return null;
        }

        console.log('Questions lookup result:'.cyan, 'Found', {questionsCount: cached.questions.length});
        return cached.questions;
    } catch (error: any) {
        console.error('Service Error: getCachedQuestions failed'.red.bold, error);
        return null;
    }
}

/**
 * Save question-answer pair to cache
 */
const saveQuestionAnswer = async ({articleId, url, question, answer}: ISaveQuestionAnswerParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveQuestionAnswer called'.cyan.italic, {articleId, question: question.substring(0, 50) + '...', answer: answer.substring(0, 100) + '...'});

    try {
        const questionKey = generateQuestionKey(question);
        const questionAnswerData = {
            question,
            answer,
            createdAt: new Date(),
        };

        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                $set: {
                    [`questionAnswers.${questionKey}`]: questionAnswerData,
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

        console.log('Question-answer pair cached successfully'.cyan, {articleId, questionKey});
        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveQuestionAnswer failed'.red.bold, error);
        return null;
    }
}

/**
 * Get cached answer for a specific question
 */
const getCachedQuestionAnswer = async ({articleId, question}: IGetCachedQuestionAnswerParams): Promise<string | null> => {
    console.log('Service: getCachedQuestionAnswer called'.cyan.italic, {articleId, question: question.substring(0, 50) + '...'});

    try {
        const questionKey = generateQuestionKey(question);
        const cached = await ArticleEnhancementModel.findOne({articleId});

        if (!cached || !cached.questionAnswers) {
            console.log('Cache lookup result:'.cyan, 'Not found');
            return null;
        }

        const questionAnswer = cached.questionAnswers.get(questionKey);
        if (!questionAnswer) {
            console.log('Question-answer lookup result:'.cyan, 'Not found', {questionKey});
            return null;
        }

        console.log('Question-answer lookup result:'.cyan, 'Found', {questionKey});
        return questionAnswer.answer;
    } catch (error: any) {
        console.error('Service Error: getCachedQuestionAnswer failed'.red.bold, error);
        return null;
    }
}

/**
 * Save news insights to cache
 */
const saveNewsInsights = async ({articleId, url, newsInsights}: ISaveNewsInsightsParams): Promise<IArticleEnhancement | null> => {
    console.log('Service: saveNewsInsights called'.cyan.italic, {articleId});

    try {
        const savedEnhancements: IArticleEnhancement = await ArticleEnhancementModel.findOneAndUpdate(
            {articleId},
            {
                $set: {
                    newsInsights,
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

        console.log('News insights cached successfully'.cyan, {articleId});
        return savedEnhancements;
    } catch (error: any) {
        console.error('Service Error: saveNewsInsights failed'.red.bold, error);
        return null;
    }
}

/**
 * Get cached news insights
 */
const getCachedNewsInsights = async ({articleId}: IGetCachedNewsInsightsParams): Promise<any | null> => {
    console.log('Service: getCachedNewsInsights called'.cyan.italic, {articleId});

    try {
        const cached = await ArticleEnhancementModel.findOne({articleId});

        if (!cached || !cached.newsInsights) {
            console.log('Cache lookup result:'.cyan, 'Not found');
            return null;
        }

        console.log('News insights lookup result:'.cyan, 'Found');
        return cached.newsInsights;
    } catch (error: any) {
        console.error('Service Error: getCachedNewsInsights failed'.red.bold, error);
        return null;
    }
}

export {
    updateArticlesProcessingStatus,
    updateArticleIdsProcessingStatus,
    getCachedArticleEnhancements,
    saveBasicEnhancements,
    hasEnhancementTypes,
    saveSummaryVariation,
    saveCaptionVariation,
    getCachedSummaryVariation,
    getCachedCaptionVariation,
    saveQuestions,
    getCachedQuestions,
    saveNewsInsights,
    getCachedNewsInsights,
    saveQuestionAnswer,
    getCachedQuestionAnswer,
};
