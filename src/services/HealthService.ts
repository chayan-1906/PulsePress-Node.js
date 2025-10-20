import "colors";
import axios from "axios";
import mongoose from "mongoose";
import nodemailer from 'nodemailer';
import {JSDOM, VirtualConsole} from 'jsdom';
import {Readability} from "@mozilla/readability";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from "@google-cloud/translate/build/src/v2";
import {apis} from "../utils/apis";
import {parseRSS} from "../utils/parseRSS";
import {getOAuth2Client} from "../utils/OAuth";
import {buildHeader} from "../utils/buildHeader";
import {getDatabaseHealth} from "../utils/databaseHealth";
import {IHealthCheckResponse} from "../types/health-check";
import {testAIModelsWithFallback} from "../utils/serviceHelpers/healthCheckHelpers";
import {EMAIL_PASS, EMAIL_USER, GEMINI_API_KEY, GOOGLE_TRANSLATE_API_KEY, GUARDIAN_API_KEY, HUGGINGFACE_API_TOKEN, NYTIMES_API_KEY} from "../config/config";
import {
    AI_COMPLEXITY_METER__MODELS,
    AI_ENHANCEMENT_MODELS,
    AI_GEOGRAPHIC_EXTRACTION_MODELS,
    AI_KEY_POINTS_EXTRACTOR_MODELS,
    AI_NEWS_INSIGHTS_MODELS,
    AI_SENTIMENT_ANALYSIS_MODELS,
    AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS,
    AI_SUMMARIZATION_MODELS,
    AI_TAG_GENERATION_MODELS,
    QUESTION_ANSWER_MODELS,
    RSS_SOURCES,
    USER_AGENTS,
} from "../utils/constants";

class HealthService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    /**
     * Check health status of NewsAPI.org service
     */
    static async checkNewsApiOrgHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkNewsApiOrgHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing NewsAPI health'.magenta);
            const {data: topHeadlines} = await axios.get(apis.topHeadlinesApi({country: 'us', pageSize: 1}), {
                headers: buildHeader(),
                timeout: 10000,
            });
            const responseTime = Date.now() - start;
            console.log('External API: NewsAPI health check successful'.magenta, {responseTime});
            console.log('NewsAPI health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${responseTime}ms`, data: topHeadlines};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkNewsApiOrgHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of Guardian API service
     */
    static async checkGuardianApiHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkGuardianApiHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Guardian API health'.magenta);
            const url = apis.guardianSearchApi({q: 'test', pageSize: 1}) + `&api-key=${GUARDIAN_API_KEY}`;
            const {data: guardianResponse} = await axios.get(url, {
                headers: buildHeader('guardian'),
                timeout: 10000,
            });
            const responseTime = Date.now() - start;
            console.log('External API: Guardian API health check successful'.magenta, {responseTime});
            console.log('Guardian API health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${responseTime}ms`, data: guardianResponse};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkGuardianApiHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of New York Times API service
     */
    static async checkNyTimesApiHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkNyTimesApiHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing NYTimes API health'.magenta);
            const url = apis.nytimesSearchApi({q: 'test', pageSize: 1}) + `&api-key=${NYTIMES_API_KEY}`;
            const {data: nytimesResponse} = await axios.get(url, {
                headers: buildHeader('nytimes'),
                timeout: 10000,
            });
            const responseTime = Date.now() - start;
            console.log('External API: NYTimes API health check successful'.magenta, {responseTime});
            console.log('NYTimes API health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${responseTime}ms`, data: nytimesResponse};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkNyTimesApiHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of all RSS feeds with success rate reporting
     */
    static async checkRssFeedsHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkRssFeedsHealth called'.cyan.italic);

        try {
            const start = Date.now();

            const testFeeds = Object.values(RSS_SOURCES)
                .flatMap(languageSources => Object.values(languageSources));

            console.debug('Debug: Total RSS feeds to test'.gray, testFeeds.length);

            const results = await Promise.allSettled(
                testFeeds.map(url => parseRSS(url)),
            );

            console.debug('Debug: RSS feed test results breakdown'.gray);
            results.forEach((result, index) => {
                const feedUrl = testFeeds[index];
                if (result.status === 'fulfilled') {
                    console.log(`External API: RSS feed healthy - ${feedUrl}`.magenta);
                } else {
                    console.error(`External API: RSS feed failed - ${feedUrl}`.red.bold, result.reason?.message || result.reason);
                }
            });

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const total = testFeeds.length;

            console.log(`RSS feed health summary: ${successful}/${total} feeds successful`.cyan);

            if (successful === 0) {
                return {status: 'unhealthy', error: {message: 'All RSS feeds failed'}};
            } else if (successful < total) {
                console.log('RSS feeds health check completed with degraded status'.green.bold);
                return {
                    status: 'degraded',
                    responseTime: `${Date.now() - start}ms`,
                    message: `${successful}/${total} RSS feeds working`,
                };
            }

            console.log('RSS feeds health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkRssFeedsHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of Email Service (Gmail SMTP)
     */
    static async checkEmailServiceHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkEmailServiceHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Email Service health'.magenta);

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS,
                },
            });

            await transporter.verify();
            const responseTime = Date.now() - start;
            console.log('External API: Email Service health check successful'.magenta, {responseTime});
            console.log('Email Service health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${responseTime}ms`};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkEmailServiceHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of Web Scraping Service (Readability + JSDOM)
     */
    static async checkWebScrapingServiceHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkWebScrapingServiceHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Web Scraping Service health'.magenta);

            const testUrl = 'https://www.news18.com/cricket/pakistan-vs-bangladesh-live-score-asia-cup-2025-super-four-pakistan-national-cricket-team-vs-bangladesh-national-cricket-team-t20-match-today-latest-cricket-scorecard-liveblog-9596118.html?utm_source=jionews&utm_medium=Referral&utm_campaign=jionews&comscorekw=jionews';
            const response = await axios.get(testUrl, {
                headers: buildHeader('webscraping', USER_AGENTS[0]),
                timeout: 10000,
            });

            const virtualConsole = new VirtualConsole();
            virtualConsole.on('error', () => {
            });
            virtualConsole.on('warn', () => {
            });

            const dom = new JSDOM(response.data, {
                url: testUrl,
                virtualConsole,
                pretendToBeVisual: false,
                resources: 'usable',
            });

            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (!article || !article.title) {
                throw new Error('Failed to parse test webpage content');
            }

            const responseTime = Date.now() - start;
            console.log('External API: Web Scraping Service health check successful'.magenta, {responseTime});
            console.log('Web Scraping Service health check completed successfully'.green.bold);
            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                data: {
                    testUrl,
                    parsedTitle: article.title,
                    contentLength: article.textContent?.length || 0,
                },
            };
        } catch (error: any) {
            console.error('Service Error: HealthService.checkWebScrapingServiceHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of Google services (OAuth and Translate API)
     */
    static async checkGoogleServicesHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkGoogleServicesHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Google services health'.magenta);
            const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});
            const results = await Promise.allSettled([
                getOAuth2Client(),
                translate.translate('test', {to: 'es'}),
            ]);

            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
                console.error('External API: Google services health check failed'.red.bold, {failures: failures.length});
                return {status: 'unhealthy', error: {message: `${failures.length} Google service(s) failed`, details: failures}};
            }

            console.log('External API: Google services health check successful'.magenta);
            console.log('Google services health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkGoogleServicesHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI News Classification Service with HuggingFace primary and Gemini fallback
     */
    static async checkAINewsClassificationHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAINewsClassificationHealth called'.cyan.italic);

        try {
            const start = Date.now();
            let huggingFaceSuccess = false;
            let geminiSuccess = false;
            let workingMethod = '';
            let errorDetails = '';

            console.log('Testing HuggingFace classification capability'.cyan);
            try {
                if (HUGGINGFACE_API_TOKEN) {
                    const payload = {
                        inputs: 'This is a test article about artificial intelligence breakthroughs in healthcare technology for classification health checking',
                        parameters: {
                            candidate_labels: ['technology', 'healthcare', 'artificial intelligence', 'other'],
                        },
                    };

                    const response = await axios.post('https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
                        payload, {
                            headers: buildHeader('huggingface'),
                            timeout: 10000,
                        },
                    );

                    if (response.data) {
                        huggingFaceSuccess = true;
                        workingMethod = 'HuggingFace (primary)';
                        console.log('HuggingFace classification test successful'.cyan);
                    }
                } else {
                    console.warn('HuggingFace API token not configured, skipping primary test'.yellow);
                }
            } catch (error: any) {
                console.warn('HuggingFace classification test failed, trying Gemini fallback'.yellow, error.message);
                errorDetails = `HuggingFace failed: ${error.message}`;
            }

            // Step 2: Test Gemini classification (fallback method)
            if (!huggingFaceSuccess) {
                console.log('Testing Gemini classification capability'.cyan);
                const geminiResult = await testAIModelsWithFallback({
                    models: AI_SUMMARIZATION_MODELS,
                    serviceName: 'AI News Classification (Gemini Fallback)',
                    testPrompt: 'Classify this news article into appropriate categories: This is a test article about artificial intelligence breakthroughs in healthcare technology for classification health checking',
                });

                if (geminiResult.success) {
                    geminiSuccess = true;
                    workingMethod = `Gemini fallback (${geminiResult.workingModel})`;
                    console.log('Gemini classification test successful'.cyan);
                } else {
                    errorDetails += geminiResult.error ? `, Gemini failed: ${geminiResult.error}` : ', Gemini failed';
                }
            }

            const totalTime = Date.now() - start;

            if (huggingFaceSuccess || geminiSuccess) {
                console.log('AI News Classification Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${totalTime}ms`,
                    data: {
                        serviceName: 'AI News Classification Service',
                        workingMethod,
                        huggingFaceAvailable: !!HUGGINGFACE_API_TOKEN,
                        huggingFaceWorking: huggingFaceSuccess,
                        geminiWorking: geminiSuccess,
                        primaryMethod: 'HuggingFace',
                        fallbackMethod: 'Gemini AI models',
                    },
                };
            } else {
                console.error('Service Error: AI News Classification Service health check failed'.red.bold, errorDetails);
                return {
                    status: 'unhealthy',
                    error: {message: `Both classification methods failed: ${errorDetails}`},
                    data: {
                        serviceName: 'AI News Classification Service',
                        huggingFaceAvailable: !!HUGGINGFACE_API_TOKEN,
                        huggingFaceWorking: false,
                        geminiWorking: false,
                        failedAt: 'both_methods',
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAINewsClassificationHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Summarization Service with cascading model fallback
     */
    static async checkAISummarizationHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAISummarizationHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_SUMMARIZATION_MODELS,
                serviceName: 'AI Summarization Service',
                testPrompt: 'Summarize this text: This is a test article for health checking',
            });

            if (success) {
                console.log('AI Summarization Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Summarization Service',
                        workingModel,
                        availableModels: AI_SUMMARIZATION_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Summarization Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Summarization Service',
                        availableModels: AI_SUMMARIZATION_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAISummarizationHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Tag Generation Service with cascading model fallback
     */
    static async checkAITagGenerationHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAITagGenerationHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_TAG_GENERATION_MODELS,
                serviceName: 'AI Tag Generation Service',
                testPrompt: 'Generate relevant tags for this text: This is a test article about technology and artificial intelligence for health checking',
            });

            if (success) {
                console.log('AI Tag Generation Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Tag Generation Service',
                        workingModel,
                        availableModels: AI_TAG_GENERATION_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Tag Generation Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Tag Generation Service',
                        availableModels: AI_TAG_GENERATION_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAITagGenerationHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Sentiment Analysis Service with cascading model fallback
     */
    static async checkAISentimentAnalysisHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAISentimentAnalysisHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_SENTIMENT_ANALYSIS_MODELS,
                serviceName: 'AI Sentiment Analysis Service',
                testPrompt: 'Analyze the sentiment of this text: This is a wonderful and positive test article for health checking',
            });

            if (success) {
                console.log('AI Sentiment Analysis Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Sentiment Analysis Service',
                        workingModel,
                        availableModels: AI_SENTIMENT_ANALYSIS_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Sentiment Analysis Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Sentiment Analysis Service',
                        availableModels: AI_SENTIMENT_ANALYSIS_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAISentimentAnalysisHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Key Points Extraction Service with cascading model fallback
     */
    static async checkAIKeyPointsExtractionHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAIKeyPointsExtractionHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_KEY_POINTS_EXTRACTOR_MODELS,
                serviceName: 'AI Key Points Extraction Service',
                testPrompt: 'Extract key points from this text: This is a test article about technology and artificial intelligence that discusses machine learning algorithms, data processing, and automated systems for health checking purposes',
            });

            if (success) {
                console.log('AI Key Points Extraction Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Key Points Extraction Service',
                        workingModel,
                        availableModels: AI_KEY_POINTS_EXTRACTOR_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Key Points Extraction Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Key Points Extraction Service',
                        availableModels: AI_KEY_POINTS_EXTRACTOR_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAIKeyPointsExtractionHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Complexity Meter Service with cascading model fallback
     */
    static async checkAIComplexityMeterHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAIComplexityMeterHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_COMPLEXITY_METER__MODELS,
                serviceName: 'AI Complexity Meter Service',
                testPrompt: 'Analyze the complexity of this text: This is a test article for health checking',
            });

            if (success) {
                console.log('AI Complexity Meter Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Complexity Meter Service',
                        workingModel,
                        availableModels: AI_COMPLEXITY_METER__MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Complexity Meter Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Complexity Meter Service',
                        availableModels: AI_COMPLEXITY_METER__MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAIComplexityMeterHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Question Answer Service with cascading model fallback
     * Tests both question generation and parallel question answering capabilities
     */
    static async checkAIQuestionAnswerHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAIQuestionAnswerHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const sampleArticle = 'Artificial intelligence is transforming healthcare through machine learning algorithms that can analyze medical data, assist in diagnosis, and predict patient outcomes. AI systems are being integrated into hospitals to improve efficiency and accuracy in medical decision-making.';

            // Step 1: Test question generation
            console.log('Testing AI question generation capability'.cyan);
            const questionGenResult = await testAIModelsWithFallback({
                models: QUESTION_ANSWER_MODELS,
                serviceName: 'AI Question Generation',
                testPrompt: `Generate 3 relevant questions based on this text: ${sampleArticle}`,
            });

            if (!questionGenResult.success) {
                console.error('Service Error: Question generation failed'.red.bold, questionGenResult.error);
                return {
                    status: 'unhealthy',
                    error: {message: `Question generation failed: ${questionGenResult.error}`},
                    data: {
                        serviceName: 'AI Question Answer Service',
                        availableModels: QUESTION_ANSWER_MODELS,
                        attemptedModels: questionGenResult.attemptedModels,
                        totalAttempts: questionGenResult.totalAttempts,
                        failedAt: 'question_generation',
                    },
                };
            }

            console.log('Question generation successful, testing question answering'.cyan);

            const testQuestions = [
                'What is artificial intelligence transforming?',
                'How do AI systems help in medical decision-making?',
                'What can machine learning algorithms analyze?'
            ];

            const answerPromises = testQuestions.map(question =>
                testAIModelsWithFallback({
                    models: QUESTION_ANSWER_MODELS,
                    serviceName: 'AI Question Answering',
                    testPrompt: `Answer this question based on the text: ${question}\n\nText: ${sampleArticle}`,
                }),
            );

            const answerResults = await Promise.allSettled(answerPromises);
            const successfulAnswers = answerResults.filter(result => result.status === 'fulfilled' && result.value.success).length;

            const totalAnswerTime = Date.now() - start;

            if (successfulAnswers === testQuestions.length) {
                console.log('AI Question Answer Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${totalAnswerTime}ms`,
                    data: {
                        serviceName: 'AI Question Answer Service',
                        workingModel: questionGenResult.workingModel,
                        availableModels: QUESTION_ANSWER_MODELS,
                        attemptedModels: questionGenResult.attemptedModels,
                        totalAttempts: questionGenResult.totalAttempts,
                        questionGenerationTime: `${questionGenResult.responseTime}ms`,
                        questionsAnswered: `${successfulAnswers}/${testQuestions.length}`,
                        testQuestions: testQuestions,
                    },
                };
            } else {
                console.error('Service Error: Question answering partially failed'.red.bold, {successful: successfulAnswers, total: testQuestions.length});
                return {
                    status: 'unhealthy',
                    error: {message: `Question answering failed: ${successfulAnswers}/${testQuestions.length} successful`},
                    data: {
                        serviceName: 'AI Question Answer Service',
                        availableModels: QUESTION_ANSWER_MODELS,
                        attemptedModels: questionGenResult.attemptedModels,
                        totalAttempts: questionGenResult.totalAttempts,
                        questionsAnswered: `${successfulAnswers}/${testQuestions.length}`,
                        failedAt: 'question_answering',
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAIQuestionAnswerHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Geographic Extraction Service with cascading model fallback
     */
    static async checkAIGeographicExtractionHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAIGeographicExtractionHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_GEOGRAPHIC_EXTRACTION_MODELS,
                serviceName: 'AI Geographic Extraction Service',
                testPrompt: 'Extract geographic locations from this text: This is a test article from New York about events in London for health checking',
            });

            if (success) {
                console.log('AI Geographic Extraction Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Geographic Extraction Service',
                        workingModel,
                        availableModels: AI_GEOGRAPHIC_EXTRACTION_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Geographic Extraction Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Geographic Extraction Service',
                        availableModels: AI_GEOGRAPHIC_EXTRACTION_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAIGeographicExtractionHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Social Media Caption Service with cascading model fallback
     */
    static async checkAISocialMediaCaptionHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAISocialMediaCaptionHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS,
                serviceName: 'AI Social Media Caption Service',
                testPrompt: 'Generate an engaging social media caption for this news: Artificial intelligence breakthroughs in healthcare are helping doctors diagnose diseases faster and more accurately than ever before',
            });

            if (success) {
                console.log('AI Social Media Caption Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Social Media Caption Service',
                        workingModel,
                        availableModels: AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Social Media Caption Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Social Media Caption Service',
                        availableModels: AI_SOCIAL_MEDIA_CAPTION_GENERATE_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAISocialMediaCaptionHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI News Insights Service with cascading model fallback
     */
    static async checkAINewsInsightsHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAINewsInsightsHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_NEWS_INSIGHTS_MODELS,
                serviceName: 'AI News Insights Service',
                testPrompt: 'Generate insightful analysis for this news article: Artificial intelligence technologies are revolutionizing healthcare with new diagnostic tools that can detect early signs of disease in medical imaging',
            });

            if (success) {
                console.log('AI News Insights Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI News Insights Service',
                        workingModel,
                        availableModels: AI_NEWS_INSIGHTS_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI News Insights Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI News Insights Service',
                        availableModels: AI_NEWS_INSIGHTS_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAINewsInsightsHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of AI Article Enhancement Service with cascading model fallback
     */
    static async checkAIArticleEnhancementHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkAIArticleEnhancementHealth called'.cyan.italic);

        try {
            const start = Date.now();
            const {success, workingModel, responseTime, error, attemptedModels, totalAttempts} = await testAIModelsWithFallback({
                models: AI_ENHANCEMENT_MODELS,
                serviceName: 'AI Article Enhancement Service',
                testPrompt: 'Enhance and provide comprehensive analysis for this article: Breakthrough discoveries in renewable energy technology are leading to more efficient solar panels that could revolutionize the global energy industry',
            });

            if (success) {
                console.log('AI Article Enhancement Service health check completed successfully'.green.bold);
                return {
                    status: 'healthy',
                    responseTime: `${Date.now() - start}ms`,
                    data: {
                        serviceName: 'AI Article Enhancement Service',
                        workingModel,
                        availableModels: AI_ENHANCEMENT_MODELS,
                        attemptedModels,
                        totalAttempts,
                        modelResponseTime: `${responseTime}ms`,
                    },
                };
            } else {
                console.error('Service Error: AI Article Enhancement Service health check failed'.red.bold, error);
                return {
                    status: 'unhealthy',
                    error: {message: error || 'All AI models failed'},
                    data: {
                        serviceName: 'AI Article Enhancement Service',
                        availableModels: AI_ENHANCEMENT_MODELS,
                        attemptedModels,
                        totalAttempts,
                    },
                };
            }
        } catch (error: any) {
            console.error('Service Error: HealthService.checkAIArticleEnhancementHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of HuggingFace API service
     */
    static async checkHuggingFaceApiHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkHuggingFaceApiHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing HuggingFace API health'.magenta);

            if (!HUGGINGFACE_API_TOKEN) {
                console.warn('Config Warning: HuggingFace API token not configured'.yellow.italic);
                return {status: 'unhealthy', error: {message: 'HuggingFace API token not configured'}};
            }

            const payload = {
                inputs: 'test content for health check',
                parameters: {
                    candidate_labels: ['news', 'non-news'],
                },
            };

            const {data: hfResponse} = await axios.post('https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
                payload, {
                    headers: buildHeader('huggingface'),
                    timeout: 10000,
                },
            );

            const responseTime = Date.now() - start;
            console.log('External API: HuggingFace API health check successful'.magenta, {responseTime});
            console.log('HuggingFace API health check completed successfully'.green.bold);
            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                data: {
                    model: 'facebook/bart-large-mnli',
                    labels: hfResponse.labels,
                    scores: hfResponse.scores,
                },
            };
        } catch (error: any) {
            console.error('Service Error: HealthService.checkHuggingFaceApiHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    /**
     * Check health status of MongoDB database connection
     */
    static async checkDatabaseHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkDatabaseHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('Database: Checking MongoDB connection health'.cyan);
            const dbHealth = getDatabaseHealth();

            if (!dbHealth.connected) {
                console.error('Database: MongoDB not connected'.red.bold, {readyState: dbHealth.readyState});
                return {
                    status: 'unhealthy',
                    error: {message: `Database not connected. State: ${dbHealth.readyState}`},
                    data: dbHealth,
                };
            }

            await mongoose.connection.db!.admin().ping();
            console.log('Database: MongoDB ping successful'.cyan);

            const responseTime = Date.now() - start;
            console.log('Database health check completed successfully'.green.bold);
            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                data: {
                    ...dbHealth,
                    poolInfo: {
                        maxPoolSize: 10,
                        configured: true,
                    },
                },
            };
        } catch (error: any) {
            console.error('Service Error: HealthService.checkDatabaseHealth failed'.red.bold, error);
            return {
                status: 'unhealthy',
                error: {message: error.message},
                data: getDatabaseHealth(),
            };
        }
    }

    /**
     * Check comprehensive health status of all system services
     */
    static async checkOverallSystemHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkOverallSystemHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('Running comprehensive system health checks'.cyan);

            const [newsHealth, guardianHealth, nyTimesHealth, rssHealth, emailHealth, webScrapingHealth, googleHealth, aiNewsClassificationHealth, aiSummarizationHealth, aiTagGenerationHealth, aiSentimentAnalysisHealth, aiKeyPointsExtractionHealth, aiComplexityMeterHealth, aiQuestionAnswerHealth, aiGeographicExtractionHealth, aiSocialMediaCaptionHealth, aiNewsInsightsHealth, aiArticleEnhancementHealth, hfHealth, dbHealth] = await Promise.allSettled([
                this.checkNewsApiOrgHealth(),
                this.checkGuardianApiHealth(),
                this.checkNyTimesApiHealth(),
                this.checkRssFeedsHealth(),
                this.checkEmailServiceHealth(),
                this.checkWebScrapingServiceHealth(),
                this.checkGoogleServicesHealth(),
                this.checkAINewsClassificationHealth(),
                this.checkAISummarizationHealth(),
                this.checkAITagGenerationHealth(),
                this.checkAISentimentAnalysisHealth(),
                this.checkAIKeyPointsExtractionHealth(),
                this.checkAIComplexityMeterHealth(),
                this.checkAIQuestionAnswerHealth(),
                this.checkAIGeographicExtractionHealth(),
                this.checkAISocialMediaCaptionHealth(),
                this.checkAINewsInsightsHealth(),
                this.checkAIArticleEnhancementHealth(),
                this.checkHuggingFaceApiHealth(),
                this.checkDatabaseHealth(),
            ]);

            const results = {
                newsAPI: newsHealth.status === 'fulfilled' ? newsHealth.value : {status: 'failed'},
                guardianAPI: guardianHealth.status === 'fulfilled' ? guardianHealth.value : {status: 'failed'},
                nyTimesAPI: nyTimesHealth.status === 'fulfilled' ? nyTimesHealth.value : {status: 'failed'},
                rssFeeds: rssHealth.status === 'fulfilled' ? rssHealth.value : {status: 'failed'},
                emailService: emailHealth.status === 'fulfilled' ? emailHealth.value : {status: 'failed'},
                webScrapingService: webScrapingHealth.status === 'fulfilled' ? webScrapingHealth.value : {status: 'failed'},
                googleServices: googleHealth.status === 'fulfilled' ? googleHealth.value : {status: 'failed'},
                aiNewsClassification: aiNewsClassificationHealth.status === 'fulfilled' ? aiNewsClassificationHealth.value : {status: 'failed'},
                aiSummarization: aiSummarizationHealth.status === 'fulfilled' ? aiSummarizationHealth.value : {status: 'failed'},
                aiTagGeneration: aiTagGenerationHealth.status === 'fulfilled' ? aiTagGenerationHealth.value : {status: 'failed'},
                aiSentimentAnalysis: aiSentimentAnalysisHealth.status === 'fulfilled' ? aiSentimentAnalysisHealth.value : {status: 'failed'},
                aiKeyPointsExtraction: aiKeyPointsExtractionHealth.status === 'fulfilled' ? aiKeyPointsExtractionHealth.value : {status: 'failed'},
                aiComplexityMeter: aiComplexityMeterHealth.status === 'fulfilled' ? aiComplexityMeterHealth.value : {status: 'failed'},
                aiQuestionAnswer: aiQuestionAnswerHealth.status === 'fulfilled' ? aiQuestionAnswerHealth.value : {status: 'failed'},
                aiGeographicExtraction: aiGeographicExtractionHealth.status === 'fulfilled' ? aiGeographicExtractionHealth.value : {status: 'failed'},
                aiSocialMediaCaption: aiSocialMediaCaptionHealth.status === 'fulfilled' ? aiSocialMediaCaptionHealth.value : {status: 'failed'},
                aiNewsInsights: aiNewsInsightsHealth.status === 'fulfilled' ? aiNewsInsightsHealth.value : {status: 'failed'},
                aiArticleEnhancement: aiArticleEnhancementHealth.status === 'fulfilled' ? aiArticleEnhancementHealth.value : {status: 'failed'},
                huggingFaceAPI: hfHealth.status === 'fulfilled' ? hfHealth.value : {status: 'failed'},
                database: dbHealth.status === 'fulfilled' ? dbHealth.value : {status: 'failed'},
            };

            const healthyServices = Object.values(results).filter(r => r.status === 'healthy').length;
            const totalServices = Object.keys(results).length;

            let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

            if (healthyServices === 0) overallStatus = 'unhealthy';
            else if (healthyServices < totalServices) overallStatus = 'degraded';

            console.log(`System health summary: ${healthyServices}/${totalServices} services healthy`.cyan, {status: overallStatus});
            console.log('Overall system health check completed successfully'.green.bold);
            return {
                status: overallStatus,
                responseTime: `${Date.now() - start}ms`,
                data: results,
                message: `${healthyServices}/${totalServices} services healthy`,
            };
        } catch (error: any) {
            console.error('Service Error: HealthService.checkOverallSystemHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }
}

export default HealthService;
