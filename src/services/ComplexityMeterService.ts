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
        console.log('Analyzing complexity for content...'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.log('Empty content provided for complexity analysis'.yellow.italic);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);

        for (let i = 0; i < AI_COMPLEXITY_METER__MODELS.length; i++) {
            const model = AI_COMPLEXITY_METER__MODELS[i];
            console.log(`Trying complexity analysis with model ${i + 1}/${AI_COMPLEXITY_METER__MODELS.length}:`.cyan, model);

            try {
                let result: ComplexityMeterResponse;
                result = await this.analyzeWithGemini(model, truncatedContent);

                if (result.complexityMeter) {
                    console.log(`✅ Complexity analysis successful with model:`.green, model);
                    console.log('Complexity analysis result:'.green, result.complexityMeter);
                    return result;
                }

                console.error(`❌ Model failed:`.red.bold, model, 'Error:'.red.bold, result.error);
            } catch (error: any) {
                console.error(`❌ Model failed:`.red.bold, model, 'Error:'.red.bold, error.message);
            }
        }

        console.error('🚨 All complexity analysis models failed'.red.bold);
        return {error: 'COMPLEXITY_METER_GENERATION_FAILED'};
    }

    /**
     * Analyze complexity using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<ComplexityMeterResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.COMPLEXITY_METER(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini complexity analysis response:'.cyan.italic, responseText);

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

        const parsed: AIComplexityMeter = JSON.parse(responseText);

        if (!parsed.complexityMeter || !parsed.complexityMeter.level) {
            console.error('Invalid complexity meter in response:'.red, parsed.complexityMeter);
            return {error: 'COMPLEXITY_PARSE_ERROR'};
        }

        if (!COMPLEXITY_LEVELS.includes(parsed.complexityMeter.level)) {
            console.error('Invalid complexity level:'.red, parsed.complexityMeter.level);
            return {error: 'INVALID_COMPLEXITY_LEVEL'};
        }

        return {
            complexityMeter: {
                level: parsed.complexityMeter.level,
                reasoning: parsed.complexityMeter.reasoning || 'AI analysis completed',
            },
        };
    }
}

export default ComplexityMeterService;
