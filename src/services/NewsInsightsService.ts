import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_NEWS_INSIGHTS_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {cleanArray, cleanStakeholderAnalysis} from "../utils/serviceHelpers/dataCleaners";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {IAINewsInsights, IMPACT_LEVELS, INewsInsightsParams, INewsInsightsResponse, TImpactLevel} from "../types/ai";

class NewsInsightsService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Generate comprehensive news insights and analysis using Gemini AI
     */
    static async generateInsights({content, url}: INewsInsightsParams): Promise<INewsInsightsResponse> {
        console.log('Service: NewsInsightsService.generateInsights called'.cyan.italic, {contentLength: content?.length, url});

        if (!content && !url) {
            console.warn('Client Error: Both content and URL missing'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Both content and URL provided'.yellow, {contentLength: content.length, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.log('Content scraping required for URL'.cyan, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Service Error: Article scraping failed'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.warn('Client Error: Empty content provided for news insights analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, 4000);

        for (let i = 0; i < AI_NEWS_INSIGHTS_MODELS.length; i++) {
            const modelName = AI_NEWS_INSIGHTS_MODELS[i];
            console.log(`Trying news insights analysis with model ${i + 1}/${AI_NEWS_INSIGHTS_MODELS.length}:`.cyan, modelName);

            try {
                const result = await this.generateWithGemini(modelName, truncatedContent);

                if (result.keyThemes && result.keyThemes.length > 0) {
                    console.log(`✅ News insights analysis successful with model:`.cyan, modelName);
                    console.log('Generated insights:'.cyan, {
                        themes: result.keyThemes,
                        impact: result.impactAssessment?.level,
                        stakeholders: Object.keys(result.stakeholderAnalysis || {}).length
                    });
                    console.log('News insights analysis completed successfully'.green.bold);
                    return {...result, powered_by: modelName};
                }

                console.error('Service Error: News insights analysis model failed'.red.bold, {model: modelName, error: result.error});
            } catch (error: any) {
                console.error('Service Error: News insights analysis model failed'.red.bold, {model: modelName, error: error.message});
            }
        }

        console.error('Service Error: All news insights analysis models failed'.red.bold);
        return {error: 'NEWS_INSIGHTS_ANALYSIS_FAILED'};
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
