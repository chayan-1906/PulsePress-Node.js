import "colors";
import AIService from "./AIService";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {AI_COMPLEXITY_METER__MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AIComplexityMeter, COMPLEXITY_LEVELS, ComplexityMeterParams, ComplexityMeterResponse} from "../types/ai";

class ComplexityMeterService {
    /**
     * Analyzes content complexity using Gemini AI
     */
    static async analyzeComplexity({content}: ComplexityMeterParams): Promise<ComplexityMeterResponse> {
        console.log('Service: ComplexityMeterService.analyzeComplexity called'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for complexity analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);
        console.log('Content truncated for analysis'.cyan, {originalLength: content.length, truncatedLength: truncatedContent.length});

        for (let i = 0; i < AI_COMPLEXITY_METER__MODELS.length; i++) {
            const model = AI_COMPLEXITY_METER__MODELS[i];
            console.log(`Trying complexity analysis with model ${i + 1}/${AI_COMPLEXITY_METER__MODELS.length}:`.cyan, model);

            try {
                let result: ComplexityMeterResponse;
                result = await this.analyzeWithGemini(model, truncatedContent);

                if (result.complexityMeter) {
                    console.log(`✅ Complexity analysis successful with model:`.cyan, model);
                    console.log('Complexity analysis result:'.cyan, result.complexityMeter);
                    console.log('Complexity analysis completed successfully'.green.bold);
                    return result;
                }

                console.error('Service Error: Complexity analysis model failed'.red.bold, {model, error: result.error});
            } catch (error: any) {
                console.error('Service Error: Complexity analysis model failed'.red.bold, {model, error: error.message});
            }
        }

        console.error('Service Error: All complexity analysis models failed'.red.bold);
        return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
    }

    /**
     * Analyze complexity using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<ComplexityMeterResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Service Error: Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating complexity analysis with Gemini'.magenta, {model: modelName});
        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.COMPLEXITY_METER(content);

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

        const parsed: AIComplexityMeter = JSON.parse(responseText);

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
