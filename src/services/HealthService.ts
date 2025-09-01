import "colors";
import axios from "axios";
import mongoose from "mongoose";
import {Translate} from "@google-cloud/translate/build/src/v2";
import {apis} from "../utils/apis";
import AIService from "./AIService";
import {parseRSS} from "../utils/parseRSS";
import {getOAuth2Client} from "../utils/OAuth";
import {buildHeader} from "../utils/buildHeader";
import {IHealthCheckResponse} from "../types/health-check";
import {GOOGLE_TRANSLATE_API_KEY} from "../config/config";
import {getDatabaseHealth} from "../utils/databaseHealth";
import {AI_SUMMARIZATION_MODELS, RSS_SOURCES} from "../utils/constants";

class HealthService {
    static async checkNewsAPIOrgHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkNewsAPIOrgHealth called'.cyan.italic);

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
            console.error('Service Error: HealthService.checkNewsAPIOrgHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkRSSFeedsHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkRSSFeedsHealth called'.cyan.italic);

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
            console.error('Service Error: HealthService.checkRSSFeedsHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkGoogleServicesHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkGoogleServicesHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Google services health'.magenta);
            const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});
            const results = await Promise.allSettled([
                getOAuth2Client(),  // Test OAuth
                translate.translate('test', {to: 'es'}),    // Test Translate API with a simple translation
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

    static async checkGeminiAIHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkGeminiAIHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('External API: Testing Gemini AI health'.magenta, {model: AI_SUMMARIZATION_MODELS[0]});
            const model = AIService.genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});
            await model.generateContent('test');
            console.log('External API: Gemini AI health check successful'.magenta);
            console.log('Gemini AI health check completed successfully'.green.bold);
            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            console.error('Service Error: HealthService.checkGeminiAIHealth failed'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

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

    static async checkOverallSystemHealth(): Promise<IHealthCheckResponse> {
        console.log('Service: HealthService.checkOverallSystemHealth called'.cyan.italic);

        try {
            const start = Date.now();
            console.log('Running comprehensive system health checks'.cyan);

            const [newsHealth, rssHealth, googleHealth, aiHealth, dbHealth] = await Promise.allSettled([
                this.checkNewsAPIOrgHealth(),
                this.checkRSSFeedsHealth(),
                this.checkGoogleServicesHealth(),
                this.checkGeminiAIHealth(),
                this.checkDatabaseHealth(),
            ]);

            const results = {
                    newsAPI: newsHealth.status === 'fulfilled' ? newsHealth.value : {status: 'failed'},
                    geminiAI: aiHealth.status === 'fulfilled' ? aiHealth.value : {status: 'failed'},
                    database: dbHealth.status === 'fulfilled' ? dbHealth.value : {status: 'failed'},
                    googleServices: googleHealth.status === 'fulfilled' ? googleHealth.value : {status: 'failed'},
                    rssFeeds: rssHealth.status === 'fulfilled' ? rssHealth.value : {status: 'failed'}
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
