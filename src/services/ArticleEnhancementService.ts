import "colors";
import {genAI} from "./AIService";
import AuthService from "./AuthService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import NewsInsightsService from "./NewsInsightsService";
import {Article, EnhancementStatus} from "../types/news";
import {AI_ENHANCEMENT_MODELS} from "../utils/constants";
import QuestionAnswerService from "./QuestionAnswerService";
import {generateArticleId} from "../utils/generateArticleId";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ReadingTimeAnalysisService from "./ReadingTimeAnalysisService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import ArticleEnhancementModel, {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {
    CombinedAIDetailsParams,
    CombinedAIParams,
    CombinedAIResponse,
    EnhanceArticlesInBackgroundParams,
    GetEnhancementForArticlesParams,
    GetEnhancementStatusByIdsParams,
    GetEnhancementStatusByIdsResponse,
    GetProcessingStatusParams,
    GetProcessingStatusResponse,
    MergeEnhancementsWithArticlesParams,
    SENTIMENT_TYPES,
} from "../types/ai";

class ArticleEnhancementService {
    /**
     * Clean up orphaned jobs that have been stuck in 'pending' status for too long
     */
    private static async cleanupOrphanedJobs(): Promise<void> {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const result = await ArticleEnhancementModel.updateMany(
                {
                    processingStatus: 'pending',
                    updatedAt: {$lt: tenMinutesAgo},
                },
                {
                    processingStatus: 'failed',
                    updatedAt: new Date(),
                },
            );

            if (result.modifiedCount > 0) {
                console.log(`🧹 Cleaned up ${result.modifiedCount} orphaned pending jobs`.yellow);
            }
        } catch (error: any) {
            console.error('Failed to cleanup orphaned jobs:'.red, error.message);
        }
    }

    /**
     * Combined AI enhancement method - smart tags, sentiment analysis, key points extractor, complexity meter, geographic entity locations
     */
    private static async aiEnhanceArticle({content, tasks}: CombinedAIParams): Promise<CombinedAIResponse> {
        console.log('Running combined AI enhancement:'.cyan.italic, tasks);

        if (!content || content.trim().length === 0) {
            console.log('Empty content provided for AI enhancement'.yellow.italic);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);

        for (let i = 0; i < AI_ENHANCEMENT_MODELS.length; i++) {
            const modelName = AI_ENHANCEMENT_MODELS[i];
            console.log(`Trying AI enhancement with model ${i + 1}/${AI_ENHANCEMENT_MODELS.length}:`.cyan, modelName);

            try {
                const model = genAI.getGenerativeModel({model: modelName});

                // Build dynamic prompt based on requested tasks using the same prompt functions
                let prompt = `Analyze this news article and provide the following information:\n\n`;

                if (tasks.includes('tags')) {
                    prompt += `SMART TAGS GENERATION:\n${AI_PROMPTS.TAG_GENERATION()}\n\n`;
                }

                if (tasks.includes('sentiment')) {
                    prompt += `SENTIMENT ANALYSIS:\n${AI_PROMPTS.SENTIMENT_ANALYSIS()}\n\n`;
                }

                if (tasks.includes('keyPoints')) {
                    prompt += `KEY POINTS EXTRACTION:\n${AI_PROMPTS.KEY_POINTS_EXTRACTION()}\n\n`;
                }

                if (tasks.includes('complexityMeter')) {
                    prompt += `COMPLEXITY METER:\n${AI_PROMPTS.COMPLEXITY_METER()}\n\n`;
                }

                if (tasks.includes('geoExtraction')) {
                    prompt += `GEOGRAPHIC EXTRACTION:\n${AI_PROMPTS.GEOGRAPHIC_EXTRACTION()}\n\n`;
                }

                prompt += `Article content: "${truncatedContent}"\n\n`;
                prompt += `${AI_PROMPTS.JSON_FORMAT_INSTRUCTIONS}\n\n`;
                prompt += `Return exactly this format:\n{\n`;

                if (tasks.includes('tags')) {
                    prompt += `  "tags": ["Politics", "Economy", "Breaking"]\n`;
                }
                if (tasks.includes('sentiment')) {
                    prompt += `  "sentiment": {"type": "positive", "confidence": 0.85},\n`;
                }
                if (tasks.includes('keyPoints')) {
                    prompt += `  "keyPoints": ["Point 1", "Point 2", "Point 3"],\n`;
                }
                if (tasks.includes('complexityMeter')) {
                    prompt += `  "complexityMeter": {"level": "medium", "reasoning": "Contains technical terms but accessible language"},\n`;
                }
                if (tasks.includes('geoExtraction')) {
                    prompt += `  "locations": ["New York City", "California", "United States"]\n`;
                }

                prompt += `}`;

                const result = await model.generateContent(prompt);
                let responseText = result.response.text().trim();

                console.log('Combined AI response:'.cyan, responseText);

                if (responseText.startsWith('```json')) {
                    responseText = responseText.substring(7);
                }
                if (responseText.startsWith('```')) {
                    responseText = responseText.substring(3);
                }
                if (responseText.endsWith('```')) {
                    responseText = responseText.substring(0, responseText.length - 3);
                }
                responseText = responseText.trim();

                if (responseText !== result.response.text().trim()) {
                    console.log('Stripped markdown, clean JSON:'.yellow, responseText);
                }

                const parsed: CombinedAIResponse = JSON.parse(responseText);
                console.log('parsed response:'.cyan.italic, parsed);

                const response: CombinedAIResponse = {};

                if (tasks.includes('tags') && parsed.tags) {
                    response.tags = parsed.tags;
                }

                if (tasks.includes('sentiment') && parsed.sentiment) {
                    if (SENTIMENT_TYPES.includes(parsed.sentiment.type)) {
                        response.sentiment = {
                            type: parsed.sentiment.type,
                            confidence: parsed.sentiment.confidence || 0.5,
                            emoji: SentimentAnalysisService.getSentimentEmoji(parsed.sentiment.type),
                            color: SentimentAnalysisService.getSentimentColor(parsed.sentiment.type),
                        };
                    }
                }

                if (tasks.includes('keyPoints') && parsed.keyPoints && Array.isArray(parsed.keyPoints)) {
                    response.keyPoints = parsed.keyPoints;
                }

                if (tasks.includes('complexityMeter') && parsed.complexityMeter) {
                    if (['easy', 'medium', 'hard'].includes(parsed.complexityMeter.level)) {
                        response.complexityMeter = {
                            level: parsed.complexityMeter.level,
                            reasoning: parsed.complexityMeter.reasoning || 'AI analysis completed',
                        };
                    }
                }

                if (tasks.includes('geoExtraction') && parsed.locations && Array.isArray(parsed.locations)) {
                    const validLocations = parsed.locations.filter(location => location && location.trim().length > 0);
                    if (validLocations.length > 0) {
                        response.locations = validLocations;
                    }
                }

                console.log(`✅ AI enhancement successful with model:`.green, modelName);
                console.log('Combined AI enhancement result:'.green, response);
                return response;
            } catch (error: any) {
                console.log(`❌ Model failed:`.yellow.bold, modelName, 'Error:'.yellow.italic, error.message);
                if (i === AI_ENHANCEMENT_MODELS.length - 1) {
                    console.error('🚨 All AI enhancement models failed'.red.bold);
                    return {error: 'AI_ENHANCEMENT_FAILED'};
                }
            }
        }

        console.error('🚨 All AI enhancement models failed'.red.bold);
        return {error: 'AI_ENHANCEMENT_FAILED'};
    }

    /**
     * Enhanced method for article details screen - includes all AI enhancements plus questions and news insights
     */
    static async enhanceArticleForDetails({email, article}: CombinedAIDetailsParams) {
        console.log('Enhanced article details processing started'.bgBlue.white.bold);

        if (email) {
            try {
                const {user} = await AuthService.getUserByEmail({email});
                const {isBlocked} = await StrikeService.checkUserBlock(email);
                if (!user || isBlocked) {
                    console.error('User not found or blocked - no AI enhancements'.yellow.italic);
                    return {error: generateNotFoundCode('user')};
                }
            } catch (error: any) {
                console.error('User verification failed, skipping enhancements'.red.bold);
                return {error: generateNotFoundCode('user')};
            }
        } else {
            console.log('No user email provided - no AI enhancements'.yellow.italic);
            return {error: generateMissingCode('email')};
        }

        const articleId = generateArticleId({article});
        const articleUrl = article.url;

        if (!articleUrl || !article.title) {
            return {error: generateMissingCode('article_data')};
        }

        await this.cleanupOrphanedJobs();

        const existingPendingJob = await ArticleEnhancementModel.findOne({
            articleId,
            processingStatus: 'pending',
        });

        if (existingPendingJob) {
            console.log(`Article ${articleId} is already being processed`.yellow);
            return {status: 'processing', articleId};
        }

        const existingEnhancedArticle: IArticleEnhancement | null = await ArticleEnhancementModel.findOne({articleId});

        if (existingEnhancedArticle && existingEnhancedArticle.processingStatus === 'completed') {
            const needsDetailsEnhancements = !existingEnhancedArticle.questions || !existingEnhancedArticle.newsInsights;

            if (!needsDetailsEnhancements) {
                console.log(`Article ${articleId} already fully enhanced for details`.green);
                const enhancedArticleData = {
                    articleId,
                    url: existingEnhancedArticle.url,
                    tags: existingEnhancedArticle.tags,
                    sentimentData: existingEnhancedArticle.sentiment,
                    keyPoints: existingEnhancedArticle.keyPoints,
                    complexityMeter: existingEnhancedArticle.complexityMeter,
                    locations: existingEnhancedArticle.locations,
                    questions: existingEnhancedArticle.questions,
                    newsInsights: existingEnhancedArticle.newsInsights,
                    complexity: existingEnhancedArticle.complexity,
                    enhanced: true,
                };
                return {article: enhancedArticleData, status: 'complete'};
            }
        }

        setTimeout(async () => {
            try {
                console.log(`Processing details enhancements for article: ${articleId}`.cyan);

                await ArticleEnhancementModel.findOneAndUpdate(
                    {articleId},
                    {
                        articleId,
                        url: articleUrl,
                        processingStatus: 'pending',
                    },
                    {upsert: true},
                );

                const content = article.content || article.description || article.title || '';
                const complexity = ReadingTimeAnalysisService.calculateReadingTimeComplexity({content});

                const aiResult: CombinedAIResponse = await this.aiEnhanceArticle({
                    content,
                    tasks: ['tags', 'sentiment', 'keyPoints', 'complexityMeter', 'geoExtraction'],
                });

                let questions = undefined;
                let newsInsights = undefined;

                // Generate questions for News Bot
                try {
                    const questionResult = await QuestionAnswerService.generateQuestions({content});
                    if (!questionResult.error && questionResult.questions) {
                        questions = questionResult.questions;
                    }
                } catch (error: any) {
                    console.error('Failed to generate questions:'.red.bold, error.message);
                }

                // Generate news insights
                try {
                    const insightsResult = await NewsInsightsService.generateInsights({content});
                    if (!insightsResult.error) {
                        newsInsights = {
                            keyThemes: insightsResult.keyThemes || [],
                            impactAssessment: insightsResult.impactAssessment || {level: 'local', description: ''},
                            contextConnections: insightsResult.contextConnections || [],
                            stakeholderAnalysis: insightsResult.stakeholderAnalysis || {winners: [], losers: [], affected: []},
                            timelineContext: insightsResult.timelineContext || [],
                        };
                    }
                } catch (error: any) {
                    console.error('Failed to generate news insights:'.red.bold, error.message);
                }

                let tags = undefined;
                let sentimentData = undefined;
                let keyPoints = undefined;
                let complexityMeter = undefined;
                let locations = undefined;

                if (!aiResult.error) {
                    tags = aiResult.tags;
                    sentimentData = aiResult.sentiment;
                    keyPoints = aiResult.keyPoints;
                    complexityMeter = aiResult.complexityMeter;
                    locations = aiResult.locations;
                }

                await ArticleEnhancementModel.findOneAndUpdate(
                    {articleId},
                    {
                        tags,
                        sentiment: sentimentData,
                        keyPoints,
                        complexityMeter,
                        locations,
                        questions,
                        newsInsights,
                        complexity,
                        processingStatus: 'completed',
                    }
                );

                console.log(`✅ Successfully enhanced article for details: ${articleId}`.green);
            } catch (error: any) {
                console.error(`Enhancement failed for article ${articleId}:`.red.bold, error.message);
                await ArticleEnhancementModel.findOneAndUpdate(
                    {articleId},
                    {processingStatus: 'failed'},
                ).catch((error: any) => {
                    console.error('ERROR: couldn\'t update article enhancement in DB:'.red.bold, error);
                });
            }
        }, 500);

        if (existingEnhancedArticle) {
            const enhancedArticleData = {
                articleId,
                url: existingEnhancedArticle.url,
                title: article.title,
                content: article.content,
                description: article.description,
                tags: existingEnhancedArticle.tags,
                sentimentData: existingEnhancedArticle.sentiment,
                keyPoints: existingEnhancedArticle.keyPoints,
                complexityMeter: existingEnhancedArticle.complexityMeter,
                locations: existingEnhancedArticle.locations,
                questions: existingEnhancedArticle.questions,
                newsInsights: existingEnhancedArticle.newsInsights,
                complexity: existingEnhancedArticle.complexity,
                enhanced: existingEnhancedArticle.processingStatus === 'completed',
            };
            return {article: enhancedArticleData, status: 'processing'};
        }

        const basicArticleData = {
            articleId,
            url: articleUrl,
            title: article.title,
            content: article.content,
            description: article.description,
            enhanced: false,
        };

        return {article: basicArticleData, status: 'processing'};
    }

    /*static isBackgroundProcessingActive(articles: Article[]): boolean {
        const articleIds = articles.map(article => generateArticleId(article));
        return articleIds.some(id => this.activeJobs.has(id));
    }*/

    static async getProcessingStatus({articles}: GetProcessingStatusParams): Promise<GetProcessingStatusResponse> {
        const articleIds = articles.map((article: Article) => generateArticleId({article}));

        // Check for pending jobs in database
        const pendingJobs = await ArticleEnhancementModel.find({
            articleId: {$in: articleIds},
            processingStatus: 'pending'
        });
        const hasActiveJobs = pendingJobs.length > 0;

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
                const {user} = await AuthService.getUserByEmail({email});
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

        // Database will track processing status for each article

        setTimeout(async () => {
            for (const article of articles) {
                try {
                    if (!article.url || !article.title) {
                        console.log('Skipping article with missing URL or title'.yellow);
                        continue;
                    }

                    const articleId = generateArticleId({article});

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

                    const complexity = ReadingTimeAnalysisService.calculateReadingTimeComplexity({content: article.content || '', description: article.description || ''});

                    const aiResult: CombinedAIResponse = await this.aiEnhanceArticle({
                        content: article.content || article.description || article.title || '',
                        tasks: ['tags', 'sentiment', 'keyPoints', 'complexityMeter', 'geoExtraction'],
                    });

                    let tags = undefined;
                    let sentimentData = undefined;
                    let keyPoints = undefined;
                    let complexityMeter = undefined;
                    let locations = undefined;

                    if (!aiResult.error) {
                        // Process tags
                        if (aiResult.tags) {
                            tags = aiResult.tags;
                        }

                        // Process sentiment data
                        if (aiResult.sentiment) {
                            sentimentData = aiResult.sentiment;
                        }

                        // Process key points
                        if (aiResult.keyPoints) {
                            keyPoints = aiResult.keyPoints;
                        }

                        // Process complexity meter
                        if (aiResult.complexityMeter) {
                            complexityMeter = aiResult.complexityMeter;
                        }

                        // Process geographic locations
                        if (aiResult.locations) {
                            locations = aiResult.locations;
                        }
                    }
                    console.log('aiResult:'.cyan.italic, aiResult);

                    const updatedEnhancedArticle = await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {
                            tags,
                            sentiment: sentimentData,
                            keyPoints,
                            complexityMeter,
                            locations,
                            complexity,
                            processingStatus: 'completed',
                        },
                    );
                    console.log(`Successfully enhanced article: ${articleId}`.green, updatedEnhancedArticle);
                } catch (error: any) {
                    const articleId = generateArticleId({article});
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

            // Database status already updated for all articles
            console.log('Background enhancement processing completed'.green.bold);
        }, 500);
    }

    static async getEnhancementsForArticles({articles}: GetEnhancementForArticlesParams): Promise<{ [articleId: string]: IArticleEnhancement }> {
        try {
            const articleIds = articles.map((article: Article) => generateArticleId({article}));

            const completedEnhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
                processingStatus: 'completed',
            });

            const enhancementMap: { [articleId: string]: IArticleEnhancement } = {};
            completedEnhancements.forEach((enhancement: IArticleEnhancement) => enhancementMap[enhancement.articleId] = enhancement);

            return enhancementMap;
        } catch (error: any) {
            console.error('Error fetching enhancements:'.red.bold, error.message);
            return {};
        }
    }

    static async getEnhancementStatusByIds({email, articleIds}: GetEnhancementStatusByIdsParams): Promise<GetEnhancementStatusByIdsResponse> {
        try {
            if (email) {
                const {user} = await AuthService.getUserByEmail({email});
                if (!user) {
                    return {error: generateNotFoundCode('user')};
                }
            }

            // Clean up any orphaned jobs first
            await this.cleanupOrphanedJobs();

            // Check for pending jobs in database
            const pendingJobs = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
                processingStatus: 'pending'
            });
            const hasActiveJobs = pendingJobs.length > 0;

            const enhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
            });

            const completedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed').length;
            const failedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'failed').length;
            const processedCount = completedCount + failedCount;

            const progress = articleIds.length > 0 ? Math.round((processedCount / articleIds.length) * 100) : 0;

            const articles = enhancements
                .filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed')
                .map(({articleId, url, tags, sentiment, complexity, complexityMeter, keyPoints, locations, questions, newsInsights}) => ({
                    articleId,
                    url,
                    tags,
                    sentiment,
                    complexity,
                    complexityMeter,
                    keyPoints,
                    locations,
                    questions,
                    newsInsights,
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
            const articleId = generateArticleId({article});
            const enhancement = enhancements[articleId];

            if (enhancement) {
                return {
                    ...article,
                    tags: enhancement.tags,
                    sentimentData: enhancement.sentiment,
                    keyPoints: enhancement.keyPoints,
                    complexityMeter: enhancement.complexityMeter,
                    locations: enhancement.locations,
                    questions: enhancement.questions,
                    newsInsights: enhancement.newsInsights,
                    complexity: enhancement.complexity,
                    enhanced: true,
                };
            }

            return {...article, enhanced: false};
        });
    }
}

export default ArticleEnhancementService;
