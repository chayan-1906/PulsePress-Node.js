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
import {AI_COMPLEXITY_METER__MODELS, AI_GEOGRAPHIC_EXTRACTION_MODELS, AI_SUMMARIZATION_MODELS, AI_TAG_GENERATION_MODELS, RSS_SOURCES, USER_AGENTS,} from "../utils/constants";

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
                timeout: 5000,
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
                timeout: 5000,
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

            const [newsHealth, guardianHealth, nyTimesHealth, rssHealth, emailHealth, webScrapingHealth, googleHealth, aiSummarizationHealth, aiTagGenerationHealth, aiComplexityMeterHealth, aiGeographicExtractionHealth, hfHealth, dbHealth] = await Promise.allSettled([
                this.checkNewsApiOrgHealth(),
                this.checkGuardianApiHealth(),
                this.checkNyTimesApiHealth(),
                this.checkRssFeedsHealth(),
                this.checkEmailServiceHealth(),
                this.checkWebScrapingServiceHealth(),
                this.checkGoogleServicesHealth(),
                this.checkAISummarizationHealth(),
                this.checkAITagGenerationHealth(),
                this.checkAIComplexityMeterHealth(),
                this.checkAIGeographicExtractionHealth(),
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
                aiSummarization: aiSummarizationHealth.status === 'fulfilled' ? aiSummarizationHealth.value : {status: 'failed'},
                aiTagGeneration: aiTagGenerationHealth.status === 'fulfilled' ? aiTagGenerationHealth.value : {status: 'failed'},
                aiComplexityMeter: aiComplexityMeterHealth.status === 'fulfilled' ? aiComplexityMeterHealth.value : {status: 'failed'},
                aiGeographicExtraction: aiGeographicExtractionHealth.status === 'fulfilled' ? aiGeographicExtractionHealth.value : {status: 'failed'},
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
