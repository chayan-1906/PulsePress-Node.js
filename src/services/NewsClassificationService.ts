import "colors";
import axios from "axios";
import {genAI} from "./AIService";
import {ClassificationResult} from "../types/ai";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import {GEMINI_API_KEY, HUGGINGFACE_API_TOKEN} from "../config/config";

class NewsClassificationService {
    private readonly huggingFaceUrl = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli';

    /**
     * Main classification method with HuggingFace -> Gemini fallback
     */
    async classifyContent(text: string): Promise<ClassificationResult> {
        console.log('Classifying content for news detection...'.cyan.italic);

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

        const truncatedText = text.substring(0, 2000);

        const payload = {
            inputs: truncatedText,
            parameters: {
                candidate_labels: [
                    'news article, current events, journalism, breaking news, news report',
                    'educational content, tutorial, general knowledge, how-to guide, academic content',
                ],
            },
        };

        const response = await axios.post(
            this.huggingFaceUrl,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        const result = response.data;

        if (!result || !result.labels || !result.scores) {
            throw new Error('Invalid HuggingFace API response format');
        }

        // Check if the first (highest scoring) label is news-related
        const topLabel = result.labels[0];
        const topScore = result.scores[0];

        console.log('HuggingFace classification result:'.cyan, {
            topLabel,
            topScore,
            allLabels: result.labels,
            allScores: result.scores,
        });

        // If news-related label has high confidence (>0.6), classify as news
        if (topLabel.includes('news') && topScore > 0.6) {
            return 'news';
        } else if (topScore > 0.7) {
            // High confidence non-news
            return 'non_news';
        } else {
            // Low confidence, let Gemini decide
            throw new Error('Low confidence classification from HuggingFace');
        }
    }

    /**
     * Gemini-based classification fallback
     */
    private async classifyWithGemini(text: string): Promise<ClassificationResult> {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }

        // Truncate text for Gemini
        const truncatedText = text.substring(0, 4000);

        const model = genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});

        const prompt = `Analyze the following content and determine if it's a NEWS article or NON-NEWS content.

                        NEWS articles contain:
                        - Current events, breaking news, journalism
                        - Political developments, business news, sports news
                        - Recent happenings, news reports, press releases
                        - Factual reporting about recent events

                        NON-NEWS content includes:
                        - Educational tutorials, how-to guides
                        - General knowledge explanations (like "What is photosynthesis?")
                        - Academic content, research papers
                        - Product reviews, personal blogs, opinion pieces
                        - Historical information, biographical content

                        Content to analyze:
                        "${truncatedText}"

                        Respond with EXACTLY one word: either "news" or "non_news"
                    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim().toLowerCase();

        console.log('Gemini classification response:'.cyan, responseText);

        if (responseText.includes('news') && !responseText.includes('non_news')) {
            return 'news';
        } else if (responseText.includes('non_news')) {
            return 'non_news';
        } else {
            console.log('Unexpected Gemini response format:'.yellow, responseText);
            throw new Error('Invalid Gemini classification response');
        }
    }
}

export default new NewsClassificationService();
