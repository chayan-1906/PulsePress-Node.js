import "colors";
import AIService from "./AIService";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_NEWS_INSIGHTS_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AINewsInsights, IMPACT_LEVELS, ImpactLevel, NewsInsightsParams, NewsInsightsResponse} from "../types/ai";

class NewsInsightsService {
    /**
     * Generate comprehensive news insights and analysis using Gemini AI
     */
    static async generateInsights({content, url}: NewsInsightsParams): Promise<NewsInsightsResponse> {
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
        const truncatedContent = articleContent.substring(0, 4000);
        console.log('Content prepared for news insights analysis'.cyan, {originalLength: articleContent.length, truncatedLength: truncatedContent.length});

        for (let i = 0; i < AI_NEWS_INSIGHTS_MODELS.length; i++) {
            const model = AI_NEWS_INSIGHTS_MODELS[i];
            console.log(`Trying news insights analysis with model ${i + 1}/${AI_NEWS_INSIGHTS_MODELS.length}:`.cyan, model);

            try {
                const result = await this.generateWithGemini(model, truncatedContent);

                if (result.keyThemes && result.keyThemes.length > 0) {
                    console.log(`✅ News insights analysis successful with model:`.cyan, model);
                    console.log('Generated insights:'.cyan, {
                        themes: result.keyThemes,
                        impact: result.impactAssessment?.level,
                        stakeholders: Object.keys(result.stakeholderAnalysis || {}).length
                    });
                    console.log('News insights analysis completed successfully'.green.bold);
                    return result;
                }

                console.error('Service Error: News insights analysis model failed'.red.bold, {model, error: result.error});
            } catch (error: any) {
                console.error('Service Error: News insights analysis model failed'.red.bold, {model, error: error.message});
            }
        }

        console.error('Service Error: All news insights analysis models failed'.red.bold);
        return {error: 'NEWS_INSIGHTS_ANALYSIS_FAILED'};
    }

    /**
     * Generate news insights using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string): Promise<NewsInsightsResponse> {
        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating news insights with Gemini'.magenta, {model: modelName});
        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.NEWS_INSIGHTS_ANALYSIS(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

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
            console.log('JSON markdown stripped'.cyan, responseText);
        }

        const parsed: AINewsInsights = JSON.parse(responseText);

        if (!parsed.keyThemes || !Array.isArray(parsed.keyThemes) || parsed.keyThemes.length === 0) {
            console.error('Service Error: Invalid keyThemes array in response'.red.bold, parsed.keyThemes);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

        const normalizedLevel = parsed.impactAssessment?.level?.toLowerCase() as ImpactLevel;
        if (!parsed.impactAssessment || !normalizedLevel || !IMPACT_LEVELS.includes(normalizedLevel as ImpactLevel)) {
            console.error('Service Error: Invalid impactAssessment in response'.red.bold, parsed.impactAssessment);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

        console.log('Processing and cleaning insights data'.cyan);
        const cleanArray = (arr: any) => Array.isArray(arr) ? arr.filter(item => item && item.trim().length > 0) : [];

        const keyThemes = cleanArray(parsed.keyThemes);
        const contextConnections = cleanArray(parsed.contextConnections || []);
        const timelineContext = cleanArray(parsed.timelineContext || []);

        const stakeholderAnalysis = parsed.stakeholderAnalysis || {};
        const cleanedStakeholderAnalysis = {
            winners: cleanArray(stakeholderAnalysis.winners || []),
            losers: cleanArray(stakeholderAnalysis.losers || []),
            affected: cleanArray(stakeholderAnalysis.affected || []),
        };

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
