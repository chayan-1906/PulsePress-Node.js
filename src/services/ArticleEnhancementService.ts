import "colors";
import {genAI} from "./AIService";
import AuthService from "./AuthService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {Article, EnhancementStatus} from "../types/news";
import {AI_ENHANCEMENT_MODELS} from "../utils/constants";
import {generateArticleId} from "../utils/generateArticleId";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ReadingTimeAnalysisService from "./ReadingTimeAnalysisService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import ArticleEnhancementModel, {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {
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
    private static activeJobs = new Set<string>();

    /**
     * Combined AI enhancement method - sentiment analysis, key points extractor, and complexity meter
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

                // TODO: Add Tag Generation

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

                // TODO: Add Content related FAQs

                prompt += `Article content: "${truncatedContent}"\n\n`;
                prompt += `${AI_PROMPTS.JSON_FORMAT_INSTRUCTIONS}\n\n`;
                prompt += `Return exactly this format:\n{\n`;

                // TODO: Add Tag Generation
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
                // TODO: Add Content related FAQs

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
                const response: CombinedAIResponse = {};

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

                // TODO: Add Content related FAQs

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

    /*static isBackgroundProcessingActive(articles: Article[]): boolean {
        const articleIds = articles.map(article => generateArticleId(article));
        return articleIds.some(id => this.activeJobs.has(id));
    }*/

    static async getProcessingStatus({articles}: GetProcessingStatusParams): Promise<GetProcessingStatusResponse> {
        const articleIds = articles.map((article: Article) => generateArticleId({article}));

        const hasActiveJobs = articleIds.some((id: string) => this.activeJobs.has(id));

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

        const articleIds = articles.map((article: Article) => generateArticleId({article}));
        articleIds.forEach((id: string) => this.activeJobs.add(id));

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

                    const complexity = ReadingTimeAnalysisService.calculateReadingTimeComplexity({article});

                    const aiResult = await this.aiEnhanceArticle({
                        content: article.content || article.description || article.title || '',
                        tasks: ['sentiment', 'keyPoints', 'complexityMeter', 'geoExtraction'],
                    });

                    let sentimentData = undefined;
                    let keyPoints = undefined;
                    let complexityMeter = undefined;
                    let locations = undefined;

                    if (!aiResult.error) {
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

                    await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {
                            sentiment: sentimentData,
                            keyPoints,
                            complexityMeter,
                            locations,
                            complexity,
                            processingStatus: 'completed',
                        },
                    );
                    console.log(`Successfully enhanced article: ${articleId}`.green);
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

            articleIds.forEach((id: string) => this.activeJobs.delete(id));
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

            const hasActiveJobs = articleIds.some((id: string) => this.activeJobs.has(id));

            const enhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
            });

            const completedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed').length;
            const failedCount = enhancements.filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'failed').length;
            const processedCount = completedCount + failedCount;

            const progress = articleIds.length > 0 ? Math.round((processedCount / articleIds.length) * 100) : 0;

            const articles = enhancements
                .filter((enhancement: IArticleEnhancement) => enhancement.processingStatus === 'completed')
                .map(({articleId, url, sentiment, complexity, complexityMeter, keyPoints, locations}) => ({
                    articleId,
                    url,
                    sentiment,
                    complexity,
                    complexityMeter,
                    keyPoints,
                    locations,
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
                    sentimentData: enhancement.sentiment,
                    keyPoints: enhancement.keyPoints,
                    complexityMeter: enhancement.complexityMeter,
                    locations: enhancement.locations,
                    complexity: enhancement.complexity,
                    enhanced: true,
                };
            }

            return {...article, enhanced: false};
        });
    }
}

export default ArticleEnhancementService;
