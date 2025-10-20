import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {GEMINI_API_KEY} from "../../config/config";
import {IAIModelTestParams, IAIModelsWithFallbackResponse} from "../../types/health-check";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

/**
 * Helper method to test AI models with cascading fallback
 */
async function testAIModelsWithFallback(params: IAIModelTestParams): Promise<IAIModelsWithFallbackResponse> {
    const {models, serviceName, testPrompt = 'test'} = params;
    const attemptedModels: string[] = [];

    for (const modelName of models) {
        attemptedModels.push(modelName);
        console.log(`External API: Testing ${serviceName} with model ${modelName}`.magenta);

        try {
            const start = Date.now();
            const model = genAI.getGenerativeModel({model: modelName});
            await model.generateContent(testPrompt);
            const responseTime = Date.now() - start;

            console.log(`External API: ${serviceName} health check successful with model ${modelName}`.magenta, {responseTime});
            return {success: true, workingModel: modelName, responseTime, attemptedModels, totalAttempts: attemptedModels.length};
        } catch (error: any) {
            console.warn(`External API: ${serviceName} failed with model ${modelName}`.yellow, error.message);
        }
    }

    return {
        success: false,
        error: `All ${models.length} models failed for ${serviceName}`,
        attemptedModels,
        totalAttempts: attemptedModels.length,
    };
}

export {testAIModelsWithFallback};
