import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import QuotaService from "./QuotaService";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_COMPLEXITY_METER__MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {COMPLEXITY_LEVELS, IAIComplexityMeter, IComplexityMeterParams, IComplexityMeterResponse} from "../types/ai";
import {getCachedArticleEnhancements, hasEnhancementTypes, saveBasicEnhancements} from "../utils/serviceHelpers/cacheHelpers";

class ComplexityMeterService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes content complexity using Gemini AI
     */
    static async analyzeComplexity({email, content, url}: IComplexityMeterParams): Promise<IComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeComplexity called'.cyan.italic, {email, content, url});

        if (!url) {
            console.warn('Client Error: URL is invalid'.yellow, {content, url});
            return {error: generateMissingCode('url')};
        }

        const {isBlocked, blockType, blockedUntil, message: blockMessage} = await StrikeService.checkUserBlock({email});
        if (isBlocked) {
            console.warn('Client Error: User is blocked from AI features'.yellow, {email, blockType, blockedUntil});
            return {
                error: 'USER_BLOCKED',
                message: blockMessage || 'You are temporarily blocked from using AI features',
                isBlocked,
                blockedUntil,
                blockType,
            };
        }

        let articleContent = content || '';
        if (!content && url) {
            console.log('External API: Scraping URL for complexity analysis'.magenta, {url});
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for complexity analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        console.log('External API: Validating news content classification'.magenta);
        const classification = await NewsClassificationService.classifyContent(articleContent);

        if (classification === 'error') {
            console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
        } else if (classification === 'non_news') {
            console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
            const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike({email, violationType: 'ai_enhancement', content: articleContent});
            return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
        } else {
            console.log('News content verified, proceeding with complexity analysis'.cyan);
        }

        const articleId = generateArticleId({url});

        const existingComplexityMeter = await hasEnhancementTypes(articleId, ['complexityMeter']);
        if (existingComplexityMeter.complexityMeter) {
            console.log('Using cached complexity meter result'.cyan);
            const cachedEnhancements = await getCachedArticleEnhancements(articleId);
            return {
                complexityMeter: cachedEnhancements?.complexityMeter || {level: 'medium', reasoning: 'AI analysis completed'},
                powered_by: 'Cached Result',
            };
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const fallbackResult = await QuotaService.executeWithModelFallback({
            primaryModel: AI_COMPLEXITY_METER__MODELS[0],
            fallbackModels: AI_COMPLEXITY_METER__MODELS.slice(1),
            executeAICall: (modelName: string) => this.analyzeWithGemini(modelName, truncatedContent),
            count: 1,
        });

        if (!fallbackResult.success) {
            console.error('Service Error: All complexity analysis models failed'.red.bold, {error: fallbackResult.error, attemptedModels: fallbackResult.attemptedModels});

            if (fallbackResult.error === 'QUOTA_EXHAUSTED') {
                return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
            } else if (fallbackResult.error === 'ALL_AI_CALLS_FAILED') {
                return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
            } else {
                return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
            }
        }

        const result = fallbackResult.result!;
        const selectedModel = fallbackResult.selectedModel;

        if (result.complexityMeter) {
            console.log('Complexity analysis completed successfully'.green.bold, {
                complexityMeter: result.complexityMeter,
                model: selectedModel,
                attemptedModels: fallbackResult.attemptedModels.length,
            });

            await saveBasicEnhancements({articleId, url, complexityMeter: result.complexityMeter});

            return {...result, powered_by: selectedModel};
        }

        console.error('Service Error: Invalid complexity analysis result'.red.bold, {model: selectedModel, error: result.error, result});
        return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
    }

    /**
     * Analyze complexity using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<IComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            throw new Error(generateMissingCode('gemini_api_key'));
        }

        console.log('External API: Generating complexity analysis with Gemini'.magenta, {model: modelName});
        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.COMPLEXITY_METER(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAIComplexityMeter = JSON.parse(responseText);

        if (!parsed.complexityMeter || !parsed.complexityMeter.level) {
            console.error('Service Error: Invalid complexity meter in response'.red.bold, parsed.complexityMeter);
            throw new Error('COMPLEXITY_PARSE_ERROR');
        }

        if (!COMPLEXITY_LEVELS.includes(parsed.complexityMeter.level)) {
            console.error('Service Error: Invalid complexity level'.red.bold, parsed.complexityMeter.level);
            throw new Error('INVALID_COMPLEXITY_LEVEL');
        }

        console.log('Complexity analysis parsed successfully'.cyan, parsed.complexityMeter);
        return {
            complexityMeter: {
                level: parsed.complexityMeter.level,
                reasoning: parsed.complexityMeter.reasoning || 'AI analysis completed',
            },
        };
    }
}

export default ComplexityMeterService;
