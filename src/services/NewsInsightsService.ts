import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import QuotaService from "./QuotaService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateArticleId} from "../utils/generateArticleId";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_NEWS_INSIGHTS_MODELS, API_CONFIG} from "../utils/constants";
import {cleanArray, cleanStakeholderAnalysis} from "../utils/serviceHelpers/dataCleaners";
import {getCachedNewsInsights, saveNewsInsights} from "../utils/serviceHelpers/cacheHelpers";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAINewsInsights, IMPACT_LEVELS, INewsInsightsParams, INewsInsightsResponse, TImpactLevel} from "../types/ai";

class NewsInsightsService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate comprehensive news insights and analysis using Gemini AI with caching
     */
    static async generateInsights({email, content, url}: INewsInsightsParams): Promise<INewsInsightsResponse> {
        console.log('Service: NewsInsightsService.generateInsights called'.cyan.italic, {email, content, url});

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
        const articleId = generateArticleId({url});
        if (!content && url) {
            console.log('Scraping URL for news insights:'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for news insights analysis'.yellow);
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
            console.log('News content verified, proceeding with news insights analysis'.bgGreen.bold);
        }

        const cached = await getCachedNewsInsights({articleId});
        if (cached) {
            console.log('News insights retrieved from cache'.cyan, {articleId});
            return {
                keyThemes: cached.keyThemes,
                impactAssessment: cached.impactAssessment,
                contextConnections: cached.contextConnections,
                stakeholderAnalysis: cached.stakeholderAnalysis,
                timelineContext: cached.timelineContext,
                powered_by: 'Cached Result',
            };
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: AI_NEWS_INSIGHTS_MODELS[0],
            fallbackModels: AI_NEWS_INSIGHTS_MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for news insights analysis'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for news insights analysis'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.generateWithGemini(selectedModel, truncatedContent);

            if (result.keyThemes && result.keyThemes.length > 0) {
                console.log('News insights analysis completed successfully'.green.bold, {
                    themes: result.keyThemes,
                    impact: result.impactAssessment?.level,
                    stakeholders: Object.keys(result.stakeholderAnalysis || {}).length,
                    model: selectedModel,
                });

                await saveNewsInsights({
                    articleId,
                    url,
                    newsInsights: {
                        keyThemes: result.keyThemes || [],
                        impactAssessment: result.impactAssessment || {level: 'local', description: ''},
                        contextConnections: result.contextConnections || [],
                        stakeholderAnalysis: {
                            winners: result.stakeholderAnalysis?.winners || [],
                            losers: result.stakeholderAnalysis?.losers || [],
                            affected: result.stakeholderAnalysis?.affected || [],
                        },
                        timelineContext: result.timelineContext || [],
                    },
                });

                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: News insights analysis failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'NEWS_INSIGHTS_ANALYSIS_FAILED'};
        } catch (error: any) {
            console.error('Service Error: News insights analysis failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'NEWS_INSIGHTS_ANALYSIS_FAILED'};
        }
    }

    /**
     * Generate news insights using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string): Promise<INewsInsightsResponse> {
        console.log('Service: NewsInsightsService.generateWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating news insights with Gemini'.magenta, {model: modelName});
        const model = this.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.NEWS_INSIGHTS_ANALYSIS(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        responseText = cleanJsonResponseMarkdown(responseText);

        const parsed: IAINewsInsights = JSON.parse(responseText);

        if (!parsed.keyThemes || !Array.isArray(parsed.keyThemes) || parsed.keyThemes.length === 0) {
            console.error('Service Error: Invalid keyThemes array in response'.red.bold, parsed.keyThemes);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

        const normalizedLevel = parsed.impactAssessment?.level?.toLowerCase() as TImpactLevel;
        if (!parsed.impactAssessment || !normalizedLevel || !IMPACT_LEVELS.includes(normalizedLevel as TImpactLevel)) {
            console.error('Service Error: Invalid impactAssessment in response'.red.bold, parsed.impactAssessment);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

        console.log('Processing and cleaning insights data'.cyan);

        const keyThemes = cleanArray(parsed.keyThemes);
        const contextConnections = cleanArray(parsed.contextConnections || []);
        const timelineContext = cleanArray(parsed.timelineContext || []);
        const cleanedStakeholderAnalysis = cleanStakeholderAnalysis(parsed.stakeholderAnalysis);

        if (keyThemes.length === 0) {
            console.error('Service Error: No valid themes found in response'.red.bold);
            return {error: 'NO_VALID_THEMES'};
        }

        console.log('News insights processed successfully'.cyan, {themes: keyThemes.length, impact: normalizedLevel});
        return {
            keyThemes,
            impactAssessment: {
                level: normalizedLevel,
                description: parsed.impactAssessment.description || 'Impact assessment completed',
            },
            contextConnections,
            stakeholderAnalysis: cleanedStakeholderAnalysis,
            timelineContext,
            powered_by: modelName,
        };
    }
}

export default NewsInsightsService;
