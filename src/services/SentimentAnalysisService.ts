import "colors";
import {genAI} from "./AIService";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {SENTIMENT_ANALYSIS_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {EnrichedArticleWithSentiment, SentimentAnalysisParams, SentimentAnalysisResponse, SentimentResult} from "../types/ai";

class SentimentAnalysisService {
    /**
     * Analyzes the sentiment of news article content using Gemini AI
     */
    static async analyzeSentiment({content}: SentimentAnalysisParams): Promise<SentimentAnalysisResponse> {
        console.log('Analyzing sentiment for content...'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.log('Empty content provided for sentiment analysis'.yellow.italic);
            return {error: 'EMPTY_CONTENT'};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 3000);

        for (let i = 0; i < SENTIMENT_ANALYSIS_MODELS.length; i++) {
            const model = SENTIMENT_ANALYSIS_MODELS[i];
            console.log(`Trying sentiment analysis with model ${i + 1}/${SENTIMENT_ANALYSIS_MODELS.length}:`.cyan, model);

            try {
                let result: SentimentAnalysisResponse;
                result = await this.analyzeWithGemini(model, truncatedContent);

                if (result.sentiment && result.confidence) {
                    console.log(`✅ Sentiment analysis successful with model:`.green, model);
                    console.log('Sentiment analysis result:'.green, {sentiment: result.sentiment, confidence: result.confidence});

                    return result;
                }

                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, result.error);
            } catch (error: any) {
                console.log(`❌ Model failed:`.yellow.bold, model, 'Error:'.yellow.italic, error.message);
            }
        }

        console.error('🚨 All sentiment analysis models failed'.red.bold);
        return {error: 'SENTIMENT_ANALYSIS_FAILED'};
    }

    /**
     * Analyze sentiment using Gemini AI
     */
    static async analyzeWithGemini(modelName: string, content: string): Promise<SentimentAnalysisResponse> {
        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = genAI.getGenerativeModel({model: modelName});

        const prompt = AI_PROMPTS.SENTIMENT_ANALYSIS(content);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        console.log('Gemini sentiment analysis response:'.cyan, responseText);

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

        if (!parsed.sentiment || !['positive', 'negative', 'neutral'].includes(parsed.sentiment)) {
            console.error('Invalid sentiment value in response:'.red, parsed.sentiment);
            return {error: 'SENTIMENT_PARSE_ERROR'};
        }

        const sentiment = parsed.sentiment as SentimentResult;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

        return {sentiment, confidence};
    }

    /**
     * Get emoji representation for sentiment
     */
    static getSentimentEmoji(sentiment: SentimentResult): string {
        switch (sentiment) {
            case 'positive':
                return '😊';
            case 'negative':
                return '😔';
            case 'neutral':
                return '😐';
            default:
                return '❓';
        }
    }

    /**
     * Get color indicator for sentiment (for UI styling)
     */
    static getSentimentColor(sentiment: SentimentResult): string {
        switch (sentiment) {
            case 'positive':
                return 'green';
            case 'negative':
                return 'red';
            case 'neutral':
                return 'gray';
            default:
                return 'gray';
        }
    }

    /**
     * Analyze sentiment for an individual article and add sentiment data
     */
    static async enrichArticleWithSentiment(article: any, shouldAnalyze: boolean = true): Promise<EnrichedArticleWithSentiment> {
        if (!shouldAnalyze) {
            return article;
        }

        try {
            const contentForAnalysis = [article.title, article.description].filter(Boolean).join('. ');

            if (!contentForAnalysis) {
                return article;
            }

            const {sentiment, confidence, error} = await this.analyzeSentiment({content: contentForAnalysis});

            if (error || !sentiment) {
                console.log('Sentiment analysis failed for article, returning without sentiment:'.yellow.italic, error);
                return article;
            }

            return {
                ...article,
                sentimentData: {
                    sentiment,
                    confidence,
                    emoji: this.getSentimentEmoji(sentiment),
                    color: this.getSentimentColor(sentiment),
                },
            };
        } catch (error: any) {
            console.error('Error enriching article with sentiment:'.yellow.italic, error.message);
            return article;
        }
    }

    /**
     * Analyze sentiment for multiple articles in batches
     */
    static async enrichArticlesWithSentiment(articles: any[], shouldAnalyze: boolean = true): Promise<EnrichedArticleWithSentiment[]> {
        if (!shouldAnalyze || !articles?.length) {
            return articles;
        }

        console.log(`Enriching ${articles.length} articles with sentiment analysis...`.cyan.italic);

        const enrichedArticles = [];
        const batchSize = 5;

        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            const batchPromises = batch.map(article => this.enrichArticleWithSentiment(article, true));

            try {
                const batchResults = await Promise.all(batchPromises);
                enrichedArticles.push(...batchResults);

                // Delay between batches to respect rate limits
                if (i + batchSize < articles.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                }
            } catch (error: any) {
                console.error('Error processing sentiment batch:'.red.bold, error.message);
                enrichedArticles.push(...batch);
            }
        }

        console.log(`Sentiment enrichment completed for ${enrichedArticles.length} articles`.green);
        return enrichedArticles;
    }
}

export default SentimentAnalysisService;
