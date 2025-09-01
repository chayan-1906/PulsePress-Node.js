import "colors";
import axios from "axios";
import AIService from "./AIService";
import {AI_PROMPTS} from "../utils/prompts";
import {buildHeader} from "../utils/buildHeader";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import {IAIClassification, TClassificationResult} from "../types/ai";
import {GEMINI_API_KEY, HUGGINGFACE_API_TOKEN} from "../config/config";

class NewsClassificationService {
    static readonly huggingFaceUrl = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';

    /**
     * Main classification method with HuggingFace -> Gemini fallback
     */
    static async classifyContent(text: string): Promise<TClassificationResult> {
        console.log('Service: NewsClassificationService.classifyContent called'.cyan.italic, {textLength: text?.length});

        if (!text || text.trim().length === 0) {
            console.warn('Client Error: Empty text provided for classification'.yellow);
            return 'error';
        }

        try {
            const result = await this.classifyWithHuggingFace(text);
            console.log('Classification with HuggingFace successful'.cyan, result);
            console.log('Content classification completed successfully'.green.bold);
            return result;
        } catch (error: any) {
            console.warn('External API: HuggingFace classification failed, trying Gemini fallback'.yellow, error.message);

            try {
                const result = await this.classifyWithGemini(text);
                console.log('Classification with Gemini successful'.cyan, result);
                console.log('Content classification completed successfully'.green.bold);
                return result;
            } catch (geminiError: any) {
                console.error('Service Error: Both HuggingFace and Gemini classification failed'.red.bold, geminiError.message);
                return 'error';
            }
        }
    }

    /**
     * HuggingFace BART-based classification using zero-shot classification
     */
    private static async classifyWithHuggingFace(text: string): Promise<TClassificationResult> {
        if (!HUGGINGFACE_API_TOKEN) {
            console.warn('Config Warning: HuggingFace API token not configured'.yellow.italic);
            throw new Error('HuggingFace API token not configured');
        }

        // Truncate text for HuggingFace
        const truncatedText = text.substring(0, 2000);
        console.log('Content prepared for HuggingFace classification'.cyan, {originalLength: text.length, truncatedLength: truncatedText.length});

        const payload = {
            inputs: truncatedText,
            parameters: {
                candidate_labels: [
                    'current news and breaking news content',
                    'educational content and tutorials',
                    'personal notifications and emails',
                    'advertisements and promotional content',
                ],
            },
        };

        console.log('External API: Calling HuggingFace classification API'.magenta);
        const response = await axios.post(
            this.huggingFaceUrl,
            payload,
            {
                headers: buildHeader('huggingface'),
                timeout: 10000,
            },
        );

        const result = response.data;

        if (!result || !result.labels || !result.scores) {
            console.error('Service Error: Invalid HuggingFace API response format'.red.bold);
            throw new Error('Invalid HuggingFace API response format');
        }

        console.log('External API: HuggingFace response received'.magenta);
        const topLabelIndex = result.scores.indexOf(Math.max(...result.scores));
        const topLabel = result.labels[topLabelIndex];
        const topScore = result.scores[topLabelIndex];

        console.log('HuggingFace classification result processed'.cyan, {
            topLabel,
            topScore,
            allLabels: result.labels,
            allScores: result.scores,
        });

        if (topScore > 0.5) {
            if (topLabel.includes('current news') || topLabel.includes('breaking news')) {
                return 'news';
            } else if (topLabel.includes('educational') || topLabel.includes('non-news')) {
                return 'non_news';
            }
        }

        console.error('Service Error: Low confidence classification from HuggingFace'.red.bold, {topScore});
        throw new Error('Low confidence classification from HuggingFace');
    }

    /**
     * Gemini-based classification fallback with enhanced prompting
     */
    private static async classifyWithGemini(text: string): Promise<TClassificationResult> {
        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            throw new Error('Gemini API key not configured');
        }

        // Truncate text for Gemini
        const truncatedText = text.substring(0, 4000);
        console.log('Content prepared for Gemini classification'.cyan, {originalLength: text.length, truncatedLength: truncatedText.length});

        console.log('External API: Generating classification with Gemini'.magenta, {model: AI_SUMMARIZATION_MODELS[0]});
        const model = AIService.genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});

        const prompt = AI_PROMPTS.NEWS_CLASSIFICATION(truncatedText);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        console.log('External API: Gemini response received'.magenta, responseText);

        try {
            const parsed: IAIClassification = JSON.parse(responseText);
            if (parsed.classification === 'news' || parsed.classification === 'non_news') {
                console.log('Gemini JSON response parsed successfully'.cyan, parsed.classification);
                return parsed.classification;
            }
        } catch (error) {
            console.warn('Service Warning: Failed to parse JSON response from Gemini'.yellow, error);
        }

        // Fallback parsing for non-JSON responses
        console.log('Using fallback text parsing for Gemini response'.cyan);
        const lowerText = responseText.toLowerCase();
        if (lowerText.includes('news') && !lowerText.includes('non_news')) {
            return 'news';
        } else if (lowerText.includes('non_news')) {
            return 'non_news';
        } else {
            console.warn('Service Warning: Unexpected Gemini response format'.yellow, responseText);
            console.warn('Service Warning: Using fallback - assuming news for unclear cases'.yellow);
            return 'news';
        }
    }
}

export default NewsClassificationService;
