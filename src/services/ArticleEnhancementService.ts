import "colors";
import {createHash} from 'crypto';
import StrikeService from "./StrikeService";
import {getUserByEmail} from "./AuthService";
import {Article, EnhancementStatus} from "../types/news";
import {generateNotFoundCode} from "../utils/generateErrorCodes";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ReadingTimeAnalysisService from "./ReadingTimeAnalysisService";
import ArticleEnhancementModel, {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {
    EnhanceArticlesInBackgroundParams,
    GetEnhancementForArticlesParams,
    GetEnhancementStatusByIdsParams,
    GetEnhancementStatusByIdsResponse,
    GetProcessingStatusParams,
    GetProcessingStatusResponse,
    MergeEnhancementsWithArticlesParams,
    SentimentAnalysisResponse,
    SentimentResult
} from "../types/ai";

class ArticleEnhancementService {
    private static activeJobs = new Set<string>();

    // TODO: Create interface for params
    private static generateArticleId({article}: { article: Article }): string {
        const data = `${article.url}-${article.title}`;
        return createHash('md5').update(data).digest('hex');
    }

    /*static isBackgroundProcessingActive(articles: Article[]): boolean {
        const articleIds = articles.map(article => this.generateArticleId({article}));
        return articleIds.some(id => this.activeJobs.has(id));
    }*/

    static async getProcessingStatus({articles}: GetProcessingStatusParams): Promise<GetProcessingStatusResponse> {
        const articleIds = articles.map(article => this.generateArticleId({article}));

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

    static async enhanceArticlesInBackground({email, articles}: EnhanceArticlesInBackgroundParams): Promise<void> {
        console.log(`Starting background enhancement for ${articles.length} articles`.cyan.italic);

        if (email) {
            try {
                const {user} = await getUserByEmail({email});
                const {isBlocked} = await StrikeService.checkUserBlock(email);
                if (!user || isBlocked) {
                    console.error('User not found - no AI enhancements'.yellow.italic);
                    return;
                }
            } catch (error: any) {
                console.error('User verification failed, skipping enhancements'.red.bold);
                return;
            }
        } else {
            console.log('No user email provided - no AI enhancements'.yellow.italic);
            return;
        }

        const articleIds = articles.map(article => this.generateArticleId({article}));
        articleIds.forEach(id => this.activeJobs.add(id));

        setTimeout(async () => {
            for (const article of articles) {
                try {
                    if (!article.url || !article.title) {
                        console.log('Skipping article with missing URL or title'.yellow);
                        continue;
                    }

                    const articleId = this.generateArticleId({article});

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

                    const complexity = ReadingTimeAnalysisService.calculateReadingTimeComplexity({article});

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
                    const articleId = this.generateArticleId({article});
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

    static async getEnhancementsForArticles({articles}: GetEnhancementForArticlesParams): Promise<{ [articleId: string]: IArticleEnhancement }> {
        try {
            const articleIds = articles.map(article => this.generateArticleId({article}));

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

    static async getEnhancementStatusByIds({email, articleIds}: GetEnhancementStatusByIdsParams): Promise<GetEnhancementStatusByIdsResponse> {
        try {
            if (email) {
                const {user} = await getUserByEmail({email});
                if (!user) {
                    return {error: generateNotFoundCode('user')};
                }
            }

            const hasActiveJobs = articleIds.some(id => this.activeJobs.has(id));

            const enhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
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

    static mergeEnhancementsWithArticles({articles, enhancements}: MergeEnhancementsWithArticlesParams): Article[] {
        return articles.map(article => {
            const articleId = this.generateArticleId({article});
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
