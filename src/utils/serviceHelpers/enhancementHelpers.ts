import "colors";
import {TAIArticleEnhancement} from "../../types/ai";
import {IArticleEnhancement} from "../../models/ArticleEnhancementSchema";

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
