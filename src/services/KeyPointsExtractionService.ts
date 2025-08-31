import "colors";
import AIService from "./AIService";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AI_KEY_POINTS_EXTRACTOR_MODELS} from "../utils/constants";
import {AIKeyPoints, KeyPointsExtractionParams, KeyPointsExtractionResponse} from "../types/ai";

class KeyPointsExtractionService {
    /**
     * Extracts key points from news article content using Gemini AI
     */
    static async extractKeyPoints({content}: KeyPointsExtractionParams): Promise<KeyPointsExtractionResponse> {
        console.log('Service: KeyPointsExtractionService.extractKeyPoints called'.cyan.italic, {contentLength: content?.length});

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for key points extraction'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);
        console.log('Content prepared for key points extraction'.cyan, {originalLength: content.length, truncatedLength: truncatedContent.length});

        for (let i = 0; i < AI_KEY_POINTS_EXTRACTOR_MODELS.length; i++) {
            const model = AI_KEY_POINTS_EXTRACTOR_MODELS[i];
            console.log(`Trying key points extraction with model ${i + 1}/${AI_KEY_POINTS_EXTRACTOR_MODELS.length}:`.cyan, model);

            try {
                let result: KeyPointsExtractionResponse;
                result = await this.extractWithGemini(model, truncatedContent);

                if (result.keyPoints && result.keyPoints.length > 0) {
                    console.log(`✅ Key points extraction successful with model:`.cyan, model);
                    console.log('Key points extraction result:'.cyan, result.keyPoints);
                    console.log('Key points extraction completed successfully'.green.bold);
                    return result;
                }

                console.error('Service Error: Key points extraction model failed'.red.bold, {model, error: result.error});
            } catch (error: any) {
                console.error('Service Error: Key points extraction model failed'.red.bold, {model, error: error.message});
            }
        }

        console.error('Service Error: All key points extraction models failed'.red.bold);
        return {error: 'KEY_POINTS_EXTRACTION_FAILED'};
    }

    /**
     * Extract key points using Gemini AI
     */
    private static async extractWithGemini(modelName: string, content: string): Promise<KeyPointsExtractionResponse> {
        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        console.log('External API: Generating key points extraction with Gemini'.magenta, {model: modelName});
        const model = AIService.genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.KEY_POINTS_EXTRACTION(content);

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

        const parsed: AIKeyPoints = JSON.parse(responseText);

        if (!parsed.keyPoints || !Array.isArray(parsed.keyPoints) || parsed.keyPoints.length === 0) {
            console.error('Service Error: Invalid key points array in response'.red.bold, parsed.keyPoints);
            return {error: 'KEY_POINTS_PARSE_ERROR'};
        }

        console.log('Key points parsed successfully'.cyan, parsed.keyPoints);
        return {keyPoints: parsed.keyPoints};
    }
}

export default KeyPointsExtractionService;
