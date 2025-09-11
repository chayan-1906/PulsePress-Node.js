import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import QuotaService from "./QuotaService";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AI_COMPLEXITY_METER__MODELS, API_CONFIG} from "../utils/constants";
import {cleanJsonResponseMarkdown, truncateContentForAI} from "../utils/serviceHelpers/aiResponseFormatters";
import {COMPLEXITY_LEVELS, IAIComplexityMeter, IComplexityMeterParams, IComplexityMeterResponse} from "../types/ai";

class ComplexityMeterService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes content complexity using Gemini AI
     */
    static async analyzeComplexity({content}: IComplexityMeterParams): Promise<IComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeComplexity called'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for complexity analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = truncateContentForAI(content, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH);

        const quotaReservation = await QuotaService.reserveQuotaForModelFallback({
            primaryModel: AI_COMPLEXITY_METER__MODELS[0],
            fallbackModels: AI_COMPLEXITY_METER__MODELS.slice(1),
            count: 1,
        });

        if (!quotaReservation.allowed) {
            console.warn('Rate Limit: Gemini API daily quota reached for complexity analysis'.yellow, {
                selectedModel: quotaReservation.selectedModel,
                quotaReserved: quotaReservation.quotaReserved,
                service: quotaReservation.service,
            });
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        const selectedModel = quotaReservation.selectedModel;
        console.log('Quota reserved for complexity analysis'.cyan, {selectedModel, quotaReserved: quotaReservation.quotaReserved});

        try {
            const result = await this.analyzeWithGemini(selectedModel, truncatedContent);

            if (result.complexityMeter) {
                console.log('Complexity analysis completed successfully'.green.bold, {complexityMeter: result.complexityMeter, model: selectedModel});
                return {...result, powered_by: selectedModel};
            }

            console.error('Service Error: Complexity analysis failed with quota-reserved model'.red.bold, {model: selectedModel, error: result.error});
            return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
        } catch (error: any) {
            console.error('Service Error: Complexity analysis failed with quota-reserved model'.red.bold, {model: selectedModel, error: error.message});
            return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
        }
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
