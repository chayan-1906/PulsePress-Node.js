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
        console.log('Generating news insights and analysis...'.cyan.italic);

        if (!content && !url) {
            console.error('Content and url both invalid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.error('Content and url both valid:'.yellow.italic, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.info('Scraping URL for news insights analysis:'.cyan.italic, url);
            const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, scrapedArticles[0]?.error);
                return {error: 'SCRAPING_FAILED'};
            }

            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent || articleContent.trim().length === 0) {
            console.log('Empty content provided for news insights analysis'.yellow.italic);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = articleContent.substring(0, 4000);

        for (let i = 0; i < AI_NEWS_INSIGHTS_MODELS.length; i++) {
            const model = AI_NEWS_INSIGHTS_MODELS[i];
            console.log(`Trying news insights analysis with model ${i + 1}/${AI_NEWS_INSIGHTS_MODELS.length}:`.cyan, model);

            try {
                const result = await this.generateWithGemini(model, truncatedContent);

                if (result.keyThemes && result.keyThemes.length > 0) {
                    console.log(`✅ News insights analysis successful with model:`.green, model);
                    console.log('Generated insights:'.green, {
                        themes: result.keyThemes,
                        impact: result.impactAssessment?.level,
                        stakeholders: Object.keys(result.stakeholderAnalysis || {}).length
                    });
                    return result;
                }

                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, result.error);
            } catch (error: any) {
                console.error(`❌ Model failed:`.yellow.bold, model, 'Error:'.red.bold, error.message);
            }
        }

        console.error('🚨 All news insights analysis models failed'.red.bold);
        return {error: 'NEWS_INSIGHTS_ANALYSIS_FAILED'};
    }

    /**
     * Generate news insights using Gemini AI
     */
    private static async generateWithGemini(modelName: string, content: string): Promise<NewsInsightsResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.NEWS_INSIGHTS_ANALYSIS(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini news insights analysis response:'.cyan, responseText);

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

        const parsed: AINewsInsights = JSON.parse(responseText);

        if (!parsed.keyThemes || !Array.isArray(parsed.keyThemes) || parsed.keyThemes.length === 0) {
            console.error('Invalid keyThemes array in response:'.red, parsed.keyThemes);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

        const normalizedLevel = parsed.impactAssessment?.level?.toLowerCase() as ImpactLevel;
        if (!parsed.impactAssessment || !normalizedLevel || !IMPACT_LEVELS.includes(normalizedLevel as ImpactLevel)) {
            console.error('Invalid impactAssessment in response:'.red, parsed.impactAssessment);
            return {error: 'NEWS_INSIGHTS_PARSE_ERROR'};
        }

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
            console.error('No valid themes found in response'.red);
            return {error: 'NO_VALID_THEMES'};
        }

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
