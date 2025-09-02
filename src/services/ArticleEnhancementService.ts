import "colors";
import AuthService from "./AuthService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {IArticle, TEnhancementStatus} from "../types/news";
import {AI_ENHANCEMENT_MODELS} from "../utils/constants";
import {generateArticleId} from "../utils/generateArticleId";
import SentimentAnalysisService from "./SentimentAnalysisService";
import ReadingTimeAnalysisService from "./ReadingTimeAnalysisService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import ArticleEnhancementModel, {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {
    ICombinedAIParams,
    ICombinedAIResponse,
    IEnhanceArticlesInBackgroundParams,
    IGetEnhancementForArticlesParams,
    IGetEnhancementStatusByIdsParams,
    IGetEnhancementStatusByIdsResponse,
    IGetProcessingStatusParams,
    IGetProcessingStatusResponse,
    IMergeEnhancementsWithArticlesParams,
    SENTIMENT_TYPES,
} from "../types/ai";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {GEMINI_API_KEY} from "../config/config";

class ArticleEnhancementService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    private static activeJobs = new Set<string>();

    /**
     * Combined AI enhancement method - smart tags, sentiment analysis, key points extractor, complexity meter, geographic entity locations
     */
    private static async aiEnhanceArticle({content, tasks}: ICombinedAIParams): Promise<ICombinedAIResponse> {
        console.log('Service: ArticleEnhancementService.aiEnhanceArticle called'.cyan.italic, {tasks});

        if (!content || content.trim().length === 0) {
            console.warn('Service Warning: Empty content provided for AI enhancement'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);

        for (let i = 0; i < AI_ENHANCEMENT_MODELS.length; i++) {
            const modelName = AI_ENHANCEMENT_MODELS[i];
            console.log(`Trying AI enhancement with model ${i + 1}/${AI_ENHANCEMENT_MODELS.length}:`.cyan, modelName);

            try {
                const model = this.genAI.getGenerativeModel({model: modelName});

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
                    console.log('Service: JSON markdown stripped'.cyan, responseText);
                }

                const parsed: ICombinedAIResponse = JSON.parse(responseText);
                console.log('parsed response:'.cyan, parsed);

                const response: ICombinedAIResponse = {};

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

                console.log(`✅ AI enhancement successful with model:`.green.bold, modelName);
                console.log('Combined AI enhancement result:'.green.bold, response);
                return {...response, powered_by: modelName};
            } catch (error: any) {
                console.warn('Service Warning: AI model failed'.yellow, {model: modelName, error: error.message});
                if (i === AI_ENHANCEMENT_MODELS.length - 1) {
                    console.error('🚨 All AI enhancement models failed'.red.bold);
                    return {error: 'AI_ENHANCEMENT_FAILED'};
                }
            }
        }

        console.error('🚨Service Error: All AI enhancement models failed'.red.bold);
        return {error: 'AI_ENHANCEMENT_FAILED'};
    }

    /**
     * Get processing status and progress for article enhancements
     */
    static async getProcessingStatus({articles}: IGetProcessingStatusParams): Promise<IGetProcessingStatusResponse> {
        console.log('Service: ArticleEnhancementService.getProcessingStatus called'.cyan.italic, {articleCount: articles.length});

        const articleIds = articles.map((article: IArticle) => generateArticleId({article}));

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

    /**
     * Process article enhancements in background with AI analysis
     */
    static async enhanceArticlesInBackground({email, articles}: IEnhanceArticlesInBackgroundParams): Promise<void> {
        console.log('Service: ArticleEnhancementService.enhanceArticlesInBackground called'.cyan.italic, {email, articleCount: articles.length});

        if (email) {
            try {
                const {user} = await AuthService.getUserByEmail({email});
                const {isBlocked} = await StrikeService.checkUserBlock(email);
                if (!user || isBlocked) {
                    console.warn('Service Warning: User not found - no AI enhancements'.yellow);
                    return;
                }
            } catch (error: any) {
                console.error('Service Error: User verification failed'.red.bold, error);
                return;
            }
        } else {
            console.warn('Service Warning: No user email provided - no AI enhancements'.yellow);
            return;
        }

        const articleIds = articles.map((article: IArticle) => generateArticleId({article}));
        articleIds.forEach((id: string) => this.activeJobs.add(id));

        setTimeout(async () => {
            for (const article of articles) {
                try {
                    if (!article.url || !article.title) {
                        console.warn('Service Warning: Skipping article with missing URL or title'.yellow);
                        continue;
                    }

                    const articleId = generateArticleId({article});

                    const existingEnhancedArticle: IArticleEnhancement | null = await ArticleEnhancementModel.findOne({articleId});
                    if (existingEnhancedArticle && existingEnhancedArticle.processingStatus === 'completed') {
                        console.log(`Article ${articleId} already enhanced`.cyan);
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

                    const aiResult: ICombinedAIResponse = await this.aiEnhanceArticle({
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
                    console.log('aiResult:'.cyan, aiResult);

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
                    console.log(`Successfully enhanced article: ${articleId}`.cyan, updatedEnhancedArticle);
                } catch (error: any) {
                    const articleId = generateArticleId({article});
                    console.error('Service Error: Article enhancement failed'.red.bold, {articleId, error: error.message});

                    await ArticleEnhancementModel.findOneAndUpdate(
                        {articleId},
                        {processingStatus: 'failed'},
                    ).catch((error: any) => {
                        console.error('Service Error: ArticleEnhancementService database update failed'.red.bold, error);
                        // Silent fail for cleanup
                    });
                }
            }

            articleIds.forEach((id: string) => this.activeJobs.delete(id));
            console.log('Background enhancement processing completed'.green.bold);
        }, 500);
    }

    /**
     * Retrieve completed enhancements for given articles
     */
    static async getEnhancementsForArticles({articles}: IGetEnhancementForArticlesParams): Promise<{ [articleId: string]: IArticleEnhancement }> {
        console.log('Service: ArticleEnhancementService.getEnhancementsForArticles called'.cyan.italic, {articleCount: articles.length});

        try {
            const articleIds = articles.map((article: IArticle) => generateArticleId({article}));

            const completedEnhancements: IArticleEnhancement[] = await ArticleEnhancementModel.find({
                articleId: {$in: articleIds},
                processingStatus: 'completed',
            });

            const enhancementMap: { [articleId: string]: IArticleEnhancement } = {};
            completedEnhancements.forEach((enhancement: IArticleEnhancement) => enhancementMap[enhancement.articleId] = enhancement);

            return enhancementMap;
        } catch (error: any) {
            console.error('Service Error: ArticleEnhancementService.getEnhancementsForArticles failed'.red.bold, error);
            return {};
        }
    }

    /**
     * Get enhancement status and enhanced articles by article IDs
     */
    static async getEnhancementStatusByIds({email, articleIds}: IGetEnhancementStatusByIdsParams): Promise<IGetEnhancementStatusByIdsResponse> {
        console.log('Service: ArticleEnhancementService.getEnhancementStatusByIds called'.cyan.italic, {email, articleCount: articleIds.length});

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
                .map(({articleId, url, tags, sentiment, complexity, complexityMeter, keyPoints, locations}) => ({
                    articleId,
                    url,
                    tags,
                    sentiment,
                    complexity,
                    complexityMeter,
                    keyPoints,
                    locations,
                    enhanced: true,
                }));

            let status: TEnhancementStatus = 'processing';
            if (!hasActiveJobs && processedCount >= articleIds.length) {
                status = 'complete';
            }

            return {status, progress, articles};
        } catch (error: any) {
            console.error('Service Error: ArticleEnhancementService.getEnhancementStatusByIds failed'.red.bold, error);
            return {status: 'failed', progress: 0, articles: []};
        }
    }

    /**
     * Merge enhancement data with original articles
     */
    static mergeEnhancementsWithArticles({articles, enhancements}: IMergeEnhancementsWithArticlesParams): IArticle[] {
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
                    complexity: enhancement.complexity,
                    enhanced: true,
                };
            }

            return {...article, enhanced: false};
        });
    }
}

export default ArticleEnhancementService;
