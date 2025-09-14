import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import NewsService from "./NewsService";
import {isListEmpty} from "../utils/list";
import {AI_PROMPTS} from "../utils/prompts";
import StrikeService from "./StrikeService";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import NewsClassificationService from "./NewsClassificationService";
import {AI_COMPLEXITY_METER__MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {COMPLEXITY_LEVELS, IAIComplexityMeter, IComplexityMeterParams, IComplexityMeterResponse} from "../types/ai";

class ComplexityMeterService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes content complexity using Gemini AI
     */
    static async analyzeComplexity({email, content, url}: IComplexityMeterParams): Promise<IComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeComplexity called'.cyan.italic, {email, content, url});

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

        if (!content && !url) {
            console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }

        if (content && url) {
            console.warn('Client Error: Content and url both valid'.yellow, {content, url});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }

        let articleContent = content || '';
        if (!content && url) {
            console.log('Scraping URL for complexity analysis:'.cyan, url);
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
            console.log('News content verified, proceeding with complexity analysis'.bgGreen.bold);
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(articleContent, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        for (let i = 0; i < AI_COMPLEXITY_METER__MODELS.length; i++) {
            const modelName = AI_COMPLEXITY_METER__MODELS[i];
            console.log(`Trying complexity analysis with model ${i + 1}/${AI_COMPLEXITY_METER__MODELS.length}:`.cyan, modelName);

            try {
                let result: IComplexityMeterResponse;
                result = await this.analyzeWithGemini(modelName, truncatedContent);

                if (result.complexityMeter) {
                    console.log(`✅ Complexity analysis successful with model:`.cyan, modelName);
                    console.log('Complexity analysis result:'.cyan, result.complexityMeter);
                    console.log('Complexity analysis completed successfully'.green.bold);
                    return {...result, powered_by: modelName};
                }

                console.error('Service Error: Complexity analysis model failed'.red.bold, {model: modelName, error: result.error});
            } catch (error: any) {
                console.error('Service Error: Complexity analysis model failed'.red.bold, {model: modelName, error: error.message});
            }
        }

        console.error('Service Error: All complexity analysis models failed'.red.bold);
        return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
    }

    /**
     * Analyze complexity using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<IComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeWithGemini called'.cyan.italic, {modelName, content,});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
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
            return {error: 'COMPLEXITY_PARSE_ERROR'};
        }

        if (!COMPLEXITY_LEVELS.includes(parsed.complexityMeter.level)) {
            console.error('Service Error: Invalid complexity level'.red.bold, parsed.complexityMeter.level);
            return {error: 'INVALID_COMPLEXITY_LEVEL'};
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
