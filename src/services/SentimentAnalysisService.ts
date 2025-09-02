import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {IArticle} from "../types/news";
import {AI_PROMPTS} from "../utils/prompts";
import {GEMINI_API_KEY} from "../config/config";
import {generateMissingCode} from "../utils/generateErrorCodes";
import {AI_SENTIMENT_ANALYSIS_MODELS} from "../utils/constants";
import {IAISentiment, IEnrichedArticleWithSentiment, ISentimentAnalysisParams, ISentimentAnalysisResponse, SENTIMENT_TYPES, TSentimentResult} from "../types/ai";

class SentimentAnalysisService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Analyzes the sentiment of news article content using Gemini AI
     */
    static async analyzeSentiment({content}: ISentimentAnalysisParams): Promise<ISentimentAnalysisResponse> {
        console.log('Service: SentimentAnalysisService.analyzeSentiment called'.cyan.italic, {content});

        if (!content || content.trim().length === 0) {
            console.warn('Client Error: Empty content provided for sentiment analysis'.yellow);
            return {error: generateMissingCode('content')};
        }

        // Truncate content to avoid token limits
        const truncatedContent = content.substring(0, 4000);

        for (let i = 0; i < AI_SENTIMENT_ANALYSIS_MODELS.length; i++) {
            const model = AI_SENTIMENT_ANALYSIS_MODELS[i];
            console.log(`Trying sentiment analysis with model ${i + 1}/${AI_SENTIMENT_ANALYSIS_MODELS.length}:`.cyan, model);

            try {
                let result: ISentimentAnalysisResponse;
                result = await this.analyzeWithGemini(model, truncatedContent);

                if (result.sentiment && result.confidence) {
                    console.log(`Sentiment analysis successful with model:`.cyan, model);
                    console.log('Sentiment analysis completed successfully'.green.bold, {sentiment: result.sentiment, confidence: result.confidence});

                    return {...result, powered_by: model};
                }

                console.error(`Service Error: Model failed:`.red.bold, model, 'Error:', result.error);
            } catch (error: any) {
                console.error(`Service Error: Model failed:`.red.bold, model, 'Error:', error.message);
            }
        }

        console.error('Service Error: All sentiment analysis models failed'.red.bold);
        return {error: 'SENTIMENT_ANALYSIS_FAILED'};
    }

    /**
     * Analyze sentiment using Gemini AI
     */
    private static async analyzeWithGemini(modelName: string, content: string): Promise<ISentimentAnalysisResponse> {
        console.log('Service: SentimentAnalysisService.analyzeWithGemini called'.cyan.italic, {modelName, content});

        if (!GEMINI_API_KEY) {
            console.warn('Config Warning: Gemini API key not configured'.yellow.italic);
            return {error: generateMissingCode('gemini_api_key')};
        }

        const model = this.genAI.getGenerativeModel({model: modelName});

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
            console.log('Stripped markdown, clean JSON:'.cyan, responseText);
        }

        const parsed: IAISentiment = JSON.parse(responseText);

        if (!parsed.sentiment || !SENTIMENT_TYPES.includes(parsed.sentiment)) {
            console.error('Service Error: Invalid sentiment value in response:'.red.bold, parsed.sentiment);
            return {error: 'SENTIMENT_PARSE_ERROR'};
        }

        const sentiment = parsed.sentiment as TSentimentResult;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

        return {sentiment, confidence};
    }

    /**
     * Get emoji representation for sentiment
     */
    static getSentimentEmoji(sentiment: TSentimentResult): string {
        console.log('Service: SentimentAnalysisService.getSentimentEmoji called'.cyan.italic, {sentiment});

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
    static getSentimentColor(sentiment: TSentimentResult): string {
        console.log('Service: SentimentAnalysisService.getSentimentColor called'.cyan.italic, {sentiment});

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
    private static async enrichArticleWithSentiment(article: any, shouldAnalyze: boolean = true): Promise<IEnrichedArticleWithSentiment> {
        console.log('Service: SentimentAnalysisService.enrichArticleWithSentiment called'.cyan.italic, {article, shouldAnalyze});

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
                console.warn('Service Warning: Sentiment analysis failed for article, returning without sentiment:'.yellow, error);
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
            console.error('Service Error: Error enriching article with sentiment:'.red.bold, error.message);
            return article;
        }
    }

    /**
     * Analyze sentiment for multiple articles in batches
     */
    static async enrichArticlesWithSentiment(articles: any[], shouldAnalyze: boolean = true): Promise<IArticle[]> {
        console.log('Service: SentimentAnalysisService.getSentimentColor called'.cyan.italic, {articles, shouldAnalyze});

        if (!shouldAnalyze || !articles?.length) {
            return articles;
        }

        console.log('Service: SentimentAnalysisService.enrichArticlesWithSentiment called'.cyan.italic);

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
                console.error('Service Error: Error processing sentiment batch:'.red.bold, error.message);
                enrichedArticles.push(...batch);
            }
        }

        console.log('Sentiment enrichment for articles completed successfully'.green.bold, {totalArticles: enrichedArticles.length});
        return enrichedArticles;
    }
}

export default SentimentAnalysisService;
