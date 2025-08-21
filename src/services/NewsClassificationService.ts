import "colors";
import axios from "axios";
import {genAI} from "./AIService";
import {ClassificationResult} from "../types/ai";
import {buildHeader} from "../utils/buildHeader";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import {GEMINI_API_KEY, HUGGINGFACE_API_TOKEN} from "../config/config";
import {AI_PROMPTS} from "../utils/prompts";

class NewsClassificationService {
    private readonly huggingFaceUrl = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';

    /**
     * Main classification method with HuggingFace -> Gemini fallback
     */
    async classifyContent(text: string): Promise<ClassificationResult> {
        console.log('Classifying content for news detection...'.cyan.italic, text);

        if (!text || text.trim().length === 0) {
            console.log('Empty text provided for classification'.yellow.italic);
            return 'error';
        }

        try {
            const result = await this.classifyWithHuggingFace(text);
            console.log('HuggingFace classification successful:'.green, result);
            return result;
        } catch (error: any) {
            console.log('HuggingFace classification failed, trying Gemini fallback...'.yellow.italic, error.message);

            try {
                const result = await this.classifyWithGemini(text);
                console.log('Gemini classification successful:'.green, result);
                return result;
            } catch (geminiError: any) {
                console.error('Both HuggingFace and Gemini classification failed:'.red.bold, geminiError.message);
                return 'error';
            }
        }
    }

    /**
     * HuggingFace BART-based classification using zero-shot classification
     */
    private async classifyWithHuggingFace(text: string): Promise<ClassificationResult> {
        if (!HUGGINGFACE_API_TOKEN) {
            throw new Error('HuggingFace API token not configured');
        }

        // Truncate text for HuggingFace
        const truncatedText = text.substring(0, 2000);

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
            throw new Error('Invalid HuggingFace API response format');
        }

        const topLabelIndex = result.scores.indexOf(Math.max(...result.scores));
        const topLabel = result.labels[topLabelIndex];
        const topScore = result.scores[topLabelIndex];

        console.log('HuggingFace classification result:'.cyan, {
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

        throw new Error('Low confidence classification from HuggingFace');
    }

    /**
     * Gemini-based classification fallback with enhanced prompting
     */
    private async classifyWithGemini(text: string): Promise<ClassificationResult> {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }

        // Truncate text for Gemini
        const truncatedText = text.substring(0, 4000);

        const model = genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});

        const prompt = AI_PROMPTS.NEWS_CLASSIFICATION(truncatedText);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        console.log('Gemini enhanced classification response:'.cyan, responseText);

        try {
            const parsed = JSON.parse(responseText);
            if (parsed.classification === 'news' || parsed.classification === 'non_news') {
                return parsed.classification;
            }
        } catch (error) {
            console.log('Failed to parse JSON response from Gemini:'.yellow, error);
        }

        // Fallback parsing for non-JSON responses
        const lowerText = responseText.toLowerCase();
        if (lowerText.includes('news') && !lowerText.includes('non_news')) {
            return 'news';
        } else if (lowerText.includes('non_news')) {
            return 'non_news';
        } else {
            console.log('Unexpected Gemini response format:'.yellow, responseText);
            console.log('Using fallback - assuming news for unclear cases'.yellow);
            return 'news';
        }
    }
}

export default new NewsClassificationService();
