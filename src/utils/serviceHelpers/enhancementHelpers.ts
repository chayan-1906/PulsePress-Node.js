import "colors";
import {IArticle} from "../../types/news";
import {TAIArticleEnhancement} from "../../types/ai";
import {generateArticleId} from "../generateArticleId";
import {IArticleEnhancement} from "../../models/ArticleEnhancementSchema";
import ArticleEnhancementModel from "../../models/ArticleEnhancementSchema";

/**
 * Identify missing enhancements from cached data
 */
export const identifyMissingEnhancements = (cached: IArticleEnhancement | null): TAIArticleEnhancement[] => {
    if (!cached) return ['tags', 'sentiment', 'keyPoints', 'complexityMeter', 'locations', 'questions', 'newsInsights'] as TAIArticleEnhancement[];

    const missing: TAIArticleEnhancement[] = [];
    if (!cached.tags) missing.push('tags');
    if (!cached.sentiment) missing.push('sentiment');
    if (!cached.keyPoints) missing.push('keyPoints');
    if (!cached.complexityMeter) missing.push('complexityMeter');
    if (!cached.locations) missing.push('locations');
    if (!cached.questions) missing.push('questions');
    if (!cached.newsInsights) missing.push('newsInsights');

    return missing;
}

/**
 * Calculate progress percentage based on available enhancements
 */
export const calculateProgress = (cached: IArticleEnhancement | null): number => {
    if (!cached) return 0;

    const featureChecks = [
        () => !!cached.tags,
        () => !!cached.sentiment,
        () => !!cached.keyPoints,
        () => !!cached.complexityMeter,
        () => !!cached.locations,
        () => !!cached.questions,
        () => !!cached.newsInsights,
    ];

    const completedFeatures = featureChecks.filter(check => check()).length;
    const totalFeatures = featureChecks.length;

    return Math.round((completedFeatures / totalFeatures) * 100);
}

/**
 * Filter out articles that are already completed to prevent overwriting their status
 */
export const filterCompletedArticles = async (articles: IArticle[]): Promise<IArticle[]> => {
    console.log('Filtering completed articles'.cyan, {totalArticles: articles.length});

    const incompleteArticles: IArticle[] = [];
    for (const article of articles) {
        const articleId = generateArticleId({url: article.url});
        const existing = await ArticleEnhancementModel.findOne({articleId});
        if (!existing || existing.processingStatus !== 'completed') {
            incompleteArticles.push(article);
        } else {
            console.log('Skipping already completed article'.cyan, {articleId});
        }
    }

    console.log('Filtering completed'.cyan, {incomplete: incompleteArticles.length, skipped: articles.length - incompleteArticles.length});
    return incompleteArticles;
}

/**
 * Filter out articleIds that are already completed to prevent overwriting their status
 */
export const filterCompletedArticleIds = async (articleIds: string[]): Promise<string[]> => {
    console.log('Filtering completed articleIds'.cyan, {totalArticleIds: articleIds.length});

    const incompleteArticleIds: string[] = [];
    for (const articleId of articleIds) {
        const existing = await ArticleEnhancementModel.findOne({articleId});
        if (!existing || existing.processingStatus !== 'completed') {
            incompleteArticleIds.push(articleId);
        } else {
            console.log('Skipping already completed articleId'.cyan, {articleId});
        }
    }

    console.log('Filtering completed articleIds'.cyan, {incomplete: incompleteArticleIds.length, skipped: articleIds.length - incompleteArticleIds.length});
    return incompleteArticleIds;
}
