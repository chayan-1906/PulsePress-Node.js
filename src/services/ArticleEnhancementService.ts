import "colors";
import {createHash} from 'crypto';
import {Article, ArticleComplexities, EnhancementStatus} from "../types/news";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ArticleEnhancementModel, {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {GetEnhancementStatusByIdsResponse, GetProcessingStatusResponse, ReadingTimeComplexityResponse, SentimentAnalysisResponse, SentimentResult} from "../types/ai";

class ArticleEnhancementService {
    private static activeJobs = new Set<string>();

    private static generateArticleId(article: Article): string {
        const data = `${article.url}-${article.title}`;
        return createHash('md5').update(data).digest('hex');
    }

    private static calculateReadingTimeComplexity(article: Article): ReadingTimeComplexityResponse {
        const text = (article.content || article.description || '').toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;

        // Simple reading time calculation (200 words per minute average)
        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        // Simple complexity calculation based on word count and sentence length
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = wordCount / Math.max(1, sentences.length);

        let level: ArticleComplexities = 'easy';

        if (wordCount > 800 || avgWordsPerSentence > 20) {
            level = 'hard';
        } else if (wordCount > 400 || avgWordsPerSentence > 15) {
            level = 'medium';
        }

        return {level, readingTimeMinutes, wordCount};
    }

    static isBackgroundProcessingActive(articles: Article[]): boolean {
        const articleIds = articles.map(article => this.generateArticleId(article));
        return articleIds.some(id => this.activeJobs.has(id));
    }

    static async getProcessingStatus(articles: Article[]): Promise<GetProcessingStatusResponse> {
        const articleIds = articles.map(article => this.generateArticleId(article));

        const hasActiveJobs = articleIds.some(id => this.activeJobs.has(id));

        const enhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
            articleId: {$in: articleIds},
        });

        const completedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed').length;
        const failedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'failed').length;
        const processedCount = completedCount + failedCount;

        const progress = articles.length > 0 ? Math.round((processedCount / articles.length) * 100) : 0;

        if (hasActiveJobs || processedCount < articles.length) {
            return {status: 'processing', progress};
        } else {
            return {status: 'complete', progress: 100};
        }
    }

    static async enhanceArticlesInBackground(articles: Article[]): Promise<void> {
        console.log(`Starting background enhancement for ${articles.length} articles`.cyan.italic);

        const articleIds = articles.map(article => this.generateArticleId(article));
        articleIds.forEach(id => this.activeJobs.add(id));

        setTimeout(async () => {
            for (const article of articles) {
                try {
                    if (!article.url || !article.title) {
                        console.log('Skipping article with missing URL or title'.yellow);
                        continue;
                    }

                    const articleId = this.generateArticleId(article);

                    const existingEnhancedArticle: IArticleEnhancement | null = await ArticleEnhancementModel.findOne({articleId});
                    if (existingEnhancedArticle && existingEnhancedArticle.processingStatus === 'completed') {
                        console.log(`Article ${articleId} already enhanced`.green);
                        continue;
                    }

                    await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {
                            articleId,
                            url: article.url,
                            processingStatus: 'pending',
                        },
                        {upsert: true},
                    );
                    console.log(`Processing enhancements for article: ${articleId}`.cyan);

                    const complexity = this.calculateReadingTimeComplexity(article);

                    const sentimentResult: SentimentAnalysisResponse = await SentimentAnalysisService.analyzeSentiment({
                        content: article.content || article.description || article.title || '',
                    });

                    let sentimentData = undefined;
                    if (!sentimentResult.error && sentimentResult.sentiment) {
                        sentimentData = {
                            sentiment: sentimentResult.sentiment as SentimentResult,
                            confidence: sentimentResult.confidence || 0,
                            emoji: SentimentAnalysisService.getSentimentEmoji(sentimentResult.sentiment),
                            color: SentimentAnalysisService.getSentimentColor(sentimentResult.sentiment),
                        };
                    }

                    await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {
                            sentiment: sentimentData,
                            complexity,
                            processingStatus: 'completed',
                        },
                    );
                    console.log(`Successfully enhanced article: ${articleId}`.green);

                } catch (error: any) {
                    const articleId = this.generateArticleId(article);
                    console.error(`Enhancement failed for article ${articleId}:`.red.bold, error.message);

                    await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {processingStatus: 'failed'},
                    ).catch((error: any) => {
                        console.error('ERROR: couldn\'t update article enhancement in DB:'.red.bold, error);
                        // Silent fail for cleanup
                    });
                }
            }

            articleIds.forEach(id => this.activeJobs.delete(id));
            console.log('Background enhancement processing completed'.green.bold);
        }, 500);
    }

    static async getEnhancementsForArticles(articles: Article[]): Promise<{ [articleId: string]: IArticleEnhancement }> {
        try {
            const articleIds = articles.map(article => this.generateArticleId(article));

            const completedEnhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
                processingStatus: 'completed',
            });

            const enhancementMap: { [articleId: string]: IArticleEnhancement } = {};
            completedEnhancements.forEach(enhancement => enhancementMap[enhancement.articleId] = enhancement);

            return enhancementMap;
        } catch (error: any) {
            console.error('Error fetching enhancements:'.red.bold, error.message);
            return {};
        }
    }

    static async getEnhancementStatusByIds(articleIds: string[]): Promise<GetEnhancementStatusByIdsResponse> {
        try {
            const hasActiveJobs = articleIds.some(id => this.activeJobs.has(id));

            const enhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds}
            });

            const completedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed').length;
            const failedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'failed').length;
            const processedCount = completedCount + failedCount;

            const progress = articleIds.length > 0 ? Math.round((processedCount / articleIds.length) * 100) : 0;

            const articles = enhancements
                .filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed')
                .map(({articleId, url, sentiment, complexity}) => ({
                    articleId,
                    url,
                    sentiment,
                    complexity,
                    enhanced: true,
                }));

            let status: EnhancementStatus = 'processing';
            if (!hasActiveJobs && processedCount >= articleIds.length) {
                status = 'complete';
            }

            return {status, progress, articles};
        } catch (error: any) {
            console.error('ERROR: getting enhancement status by IDs:'.red.bold, error.message);
            return {status: 'failed', progress: 0, articles: []};
        }
    }

    static mergeEnhancementsWithArticles(articles: Article[], enhancements: { [articleId: string]: IArticleEnhancement }): Article[] {
        return articles.map(article => {
            const articleId = this.generateArticleId(article);
            const enhancement = enhancements[articleId];

            if (enhancement) {
                return {
                    ...article,
                    articleId,  // TODO: Remove when Article interface has non-null articleId
                    sentimentData: enhancement.sentiment,
                    complexity: enhancement.complexity,
                    enhanced: true,
                };
            }

            return {...article, enhanced: false};
        });
    }
}

export default ArticleEnhancementService;
