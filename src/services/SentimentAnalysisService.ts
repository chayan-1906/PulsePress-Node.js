import "colors";
import {createHash} from 'crypto';
import {genAI} from "./AIService";
import {GEMINI_API_KEY, NODE_ENV} from "../config/config";
import {AI_SUMMARIZATION_MODELS} from "../utils/constants";
import {generateMissingCode} from "../utils/generateErrorCodes";
import CachedSentimentModel, {ICachedSentiment} from "../models/CachedSentimentSchema";
import {EnrichedArticleWithSentiment, SentimentAnalysisParams, SentimentAnalysisResponse, SentimentResult} from "../types/ai";

class SentimentAnalysisService {
    /**
     * Analyzes the sentiment of news article content using Gemini AI
     */
    async analyzeSentiment({content}: SentimentAnalysisParams): Promise<SentimentAnalysisResponse> {
        console.log('Analyzing sentiment for content...'.cyan.italic);

        if (!content || content.trim().length === 0) {
            console.log('Empty content provided for sentiment analysis'.yellow.italic);
            return {error: 'EMPTY_CONTENT'};
        }

        if (!GEMINI_API_KEY) {
            console.error('Gemini API key not configured'.red.bold);
            return {error: generateMissingCode('gemini_api_key')};
        }

        try {
            // Truncate content to avoid token limits
            const truncatedContent = content.substring(0, 3000);

            const contentHash = this.generateContentHash(truncatedContent);
            console.log('Content hash generated for sentiment caching:'.cyan.italic, contentHash);

            if (NODE_ENV === 'production') {
                const cached = await this.getCachedSentiment(contentHash);
                const {sentiment, confidence} = cached || {};
                if (cached) {
                    console.log('Returning cached sentiment result:'.green, {sentiment, confidence});
                    return {sentiment, confidence};
                }
            }

            const model = genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});

            const prompt = `Analyze the sentiment of this news article content and determine if the overall tone is positive, negative, or neutral.

                            Guidelines for sentiment classification:
                            - POSITIVE: Good news, achievements, progress, solutions, celebrations, positive outcomes, uplifting stories
                            - NEGATIVE: Bad news, problems, conflicts, disasters, failures, scandals, tragedies, concerning developments
                            - NEUTRAL: Factual reporting without emotional tone, balanced coverage, informational updates, routine announcements

                            Consider the overall impact and emotional tone of the article, not just individual words.

                            Article content: "${truncatedContent}"

                            CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

                            Return exactly this format:
                            {"sentiment": "positive", "confidence": 0.85}

                            Valid sentiment values: positive, negative, neutral
                            Confidence must be a number between 0.1 and 1.0`
            ;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            console.log('Gemini sentiment analysis response:'.cyan, responseText);

            try {
                const parsed = JSON.parse(responseText);

                if (!parsed.sentiment || !['positive', 'negative', 'neutral'].includes(parsed.sentiment)) {
                    console.error('Invalid sentiment value in response:'.red, parsed.sentiment);
                    return {error: 'SENTIMENT_PARSE_ERROR'};
                }

                const sentiment = parsed.sentiment as SentimentResult;
                const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

                console.log('Sentiment analysis result:'.green, {sentiment, confidence});

                if (NODE_ENV === 'production') {
                    await this.saveSentimentToCache(contentHash, sentiment, confidence);
                }

                return {sentiment, confidence};
            } catch (error: any) {
                console.error('Could not parse JSON from Gemini response:'.red, responseText);
                console.error('Parse error:'.red, error.message);
                return {error: 'SENTIMENT_PARSE_ERROR'};
            }
        } catch (error: any) {
            console.error('ERROR: Sentiment analysis failed:'.red.bold, error.message);
            return {error: 'SENTIMENT_ANALYSIS_FAILED'};
        }
    }

    /**
     * Get emoji representation for sentiment
     */
    getSentimentEmoji(sentiment: SentimentResult): string {
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
    getSentimentColor(sentiment: SentimentResult): string {
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
     * Generate hash for caching sentiment results
     */
    private generateContentHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Get cached sentiment result
     */
    private async getCachedSentiment(contentHash: string): Promise<ICachedSentiment | null> {
        try {
            const cached = await CachedSentimentModel.findOne({
                contentHash,
                expiresAt: {$gt: new Date()},
            });
            console.log('Cached sentiment lookup:'.cyan.italic, cached ? 'found' : 'not found');
            return cached;
        } catch (error: any) {
            console.error('Error retrieving cached sentiment:'.yellow.italic, error.message);
            return null;
        }
    }

    /**
     * Save sentiment result to cache
     */
    private async saveSentimentToCache(contentHash: string, sentiment: SentimentResult, confidence: number): Promise<void> {
        try {
            await CachedSentimentModel.create({contentHash, sentiment, confidence});
            console.log('Sentiment result cached successfully:'.green, {sentiment, confidence});
        } catch (error: any) {
            console.error('Error saving sentiment to cache:'.yellow.italic, error.message);
            // Don't throw error, caching failure shouldn't break the main functionality
        }
    }

    /**
     * Analyze sentiment for an individual article and add sentiment data
     */
    async enrichArticleWithSentiment(article: any, shouldAnalyze: boolean = true): Promise<EnrichedArticleWithSentiment> {
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
     * Analyze sentiment for multiple articles in batches to avoid overwhelming the API
     */
    async enrichArticlesWithSentiment(articles: any[], shouldAnalyze: boolean = true): Promise<EnrichedArticleWithSentiment[]> {
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

export default new SentimentAnalysisService();
