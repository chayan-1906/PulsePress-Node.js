import "colors";
import {IArticle, IQualityScore} from "../../types/news";
import {TRUSTED_NEWS_SOURCES} from "../constants";

/**
 * Assess article quality based on source reliability, relevance, and content
 */
export const assessContentQuality = (article: IArticle, query?: string): IQualityScore => {
    console.log('Service: assessContentQuality called'.cyan.italic, {article, query});

    let score = 0.5;
    const reasons: string[] = [];
    let isRelevant = true;
    let isProfessional = true;

    const title = article.title?.toLowerCase() || '';
    const sourceName = article.source?.name?.toLowerCase() || '';

    const tier1Match = TRUSTED_NEWS_SOURCES.tier1.some(source => sourceName.includes(source.toLowerCase()));
    const tier2Match = TRUSTED_NEWS_SOURCES.tier2.some(source => sourceName.includes(source.toLowerCase()));
    const tier3Match = TRUSTED_NEWS_SOURCES.tier3.some(source => sourceName.includes(source.toLowerCase()));

    if (tier1Match) {
        score += 0.3;
        reasons.push('Tier 1 trusted source');
    } else if (tier2Match) {
        score += 0.2;
        reasons.push('Tier 2 reliable source');
    } else if (tier3Match) {
        score += 0.1;
        reasons.push('Tier 3 acceptable source');
    }

    if (title.length < 10) {
        score -= 0.2;
        reasons.push('Title too short');
    }

    if (!article.description || article.description.length < 30) {
        score -= 0.1;
        reasons.push('Missing or short description');
    }

    if (query) {
        const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
        const description = article.description?.toLowerCase() || '';

        const titleMatches = queryWords.filter(word => title.includes(word)).length;
        const descMatches = queryWords.filter(word => description.includes(word)).length;

        const totalMatches = titleMatches + (descMatches * 0.5);
        const relevance = Math.min(1.0, totalMatches / queryWords.length);

        if (relevance > 0.7) {
            score += 0.3;
            reasons.push('High relevance');
        } else if (relevance > 0.4) {
            score += 0.1;
            reasons.push('Good relevance');
        } else if (relevance > 0.2) {
            reasons.push('Medium relevance');
        } else if (relevance < 0.2) {
            score -= 0.3;
            isRelevant = false;
            reasons.push('Low relevance');
        }
    }

    const clickbaitPatterns = [/you won't believe/i, /shocking/i, /this will blow your mind/i, /number \d+ will surprise you/i, /one weird trick/i, /hate this/i, /must see/i, /amazing secret/i];

    if (clickbaitPatterns.some(pattern => pattern.test(title))) {
        score -= 0.4;
        isProfessional = false;
        reasons.push('Clickbait title');
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        reasons,
        isRelevant,
        isProfessional,
    };
}

/**
 * Check if article is duplicate based on URL comparison
 */
export const isDuplicateArticle = (article: IArticle, existing: IArticle[]): boolean => {
    console.log('Service: isDuplicateArticle called'.cyan.italic, {article, existing});

    return existing.some(existingArticle => !!(article.url && existingArticle.url && article.url === existingArticle.url));
}
