import "colors";
import {genAI} from "./AIService";
import {GEMINI_API_KEY} from "../config/config";
import {AI_ENHANCEMENT_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {KeyPointsExtractionParams, KeyPointsExtractionResponse} from "../types/ai";

class KeyPointsExtractionService {
    /**
     * Extracts key points from news article content using Gemini AI
     */
    static async extractKeyPoints({content}: KeyPointsExtractionParams): Promise<KeyPointsExtractionResponse> {
        console.log('Extracting key points for content...'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.log('Empty content provided for key points extraction'.yellow.italic);
            return {error: 'EMPTY_CONTENT'};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 3000);

        for (let i = 0; i < AI_ENHANCEMENT_MODELS.length; i++) {
            const model = AI_ENHANCEMENT_MODELS[i];
            console.log(`Trying key points extraction with model ${i + 1}/${AI_ENHANCEMENT_MODELS.length}:`.cyan, model);

            try {
                let result: KeyPointsExtractionResponse;
                result = await this.extractWithGemini(model, truncatedContent);

                if (result.keyPoints && result.keyPoints.length > 0) {
                    console.log(`✅ Key points extraction successful with model:`.green, model);
                    console.log('Key points extraction result:'.green, result.keyPoints);
                    return result;
                }

                console.error(`❌ Model failed:`.red.bold, model, 'Error:'.red.bold, result.error);
            } catch (error: any) {
                console.error(`❌ Model failed:`.red.bold, model, 'Error:'.red.bold, error.message);
            }
        }

        console.error('🚨 All key points extraction models failed'.red.bold);
        return {error: 'KEY_POINTS_EXTRACTION_FAILED'};
    }

    /**
     * Extract key points using Gemini AI
     */
    static async extractWithGemini(modelName: string, content: string): Promise<KeyPointsExtractionResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = genAI.getGenerativeModel({model: modelName});

        const prompt = `Analyze this news article content and extract 3-5 key points that summarize the most important information.

                    Guidelines for key points extraction:
                    - Focus on main facts, events, and outcomes mentioned in the article
                    - Each point should be concise but informative (1-2 sentences max)
                    - Prioritize factual information over opinions
                    - Avoid redundancy between points
                    - Present points in order of importance

                    Article content: "${content}"

                    CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

                    Return exactly this format:
                    {"keyPoints": ["Point 1", "Point 2", "Point 3"]}

                    Each key point should be a clear, concise statement.`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini key points extraction response:'.cyan.italic, responseText);

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

        const parsed = JSON.parse(responseText);

        if (!parsed.keyPoints || !Array.isArray(parsed.keyPoints) || parsed.keyPoints.length === 0) {
            console.error('Invalid key points array in response:'.red, parsed.keyPoints);
            return {error: 'KEY_POINTS_PARSE_ERROR'};
        }

        return {keyPoints: parsed.keyPoints};
    }
}

export default KeyPointsExtractionService;
