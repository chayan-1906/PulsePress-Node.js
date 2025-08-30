import "colors";
import axios from "axios";
import mongoose from "mongoose";
import {Translate} from "@google-cloud/translate/build/src/v2";
import {apis} from "../utils/apis";
import AIService from "./AIService";
import {parseRSS} from "../utils/parseRSS";
import {getOAuth2Client} from "../utils/OAuth";
import {buildHeader} from "../utils/buildHeader";
import {HealthCheckResponse} from "../types/health-check";
import {GOOGLE_TRANSLATE_API_KEY} from "../config/config";
import {getDatabaseHealth} from "../utils/databaseHealth";
import {AI_SUMMARIZATION_MODELS, RSS_SOURCES} from "../utils/constants";

class HealthService {
    static async checkNewsAPIOrgHealth(): Promise<HealthCheckResponse> {
        console.info('checkNewsAPIOrgHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();
            const {data: topHeadlines} = await axios.get(apis.topHeadlinesApi({country: 'us', pageSize: 1}), {
                headers: buildHeader(),
                timeout: 5000,
            });
            const responseTime = Date.now() - start;
            return {status: 'healthy', responseTime: `${responseTime}ms`, data: topHeadlines};
        } catch (error: any) {
            console.error('ERROR: inside catch of checkNewsAPIOrgHealth:'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkRSSFeedsHealth(): Promise<HealthCheckResponse> {
        console.info('checkRSSFeedsHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();

            const testFeeds = Object.values(RSS_SOURCES)
                .flatMap(languageSources => Object.values(languageSources));

            console.log('DEBUG - Total feeds to test:'.cyan.italic, testFeeds.length);

            const results = await Promise.allSettled(
                testFeeds.map(url => parseRSS(url)),
            );

            console.log('DEBUG - Results breakdown:'.cyan.italic);
            results.forEach((result, index) => {
                const feedUrl = testFeeds[index];
                if (result.status === 'fulfilled') {
                    console.log(`✅ SUCCESS: ${feedUrl}`.green.bold);
                } else {
                    console.error(`❌ FAILED: ${feedUrl} - Error:`.red.bold, result.reason?.message || result.reason);
                }
            });

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const total = testFeeds.length;

            console.log(`DEBUG - Summary: ${successful}/${total} feeds successful`.green.bold);

            if (successful === 0) {
                return {status: 'unhealthy', error: {message: 'All RSS feeds failed'}};
            } else if (successful < total) {
                return {
                    status: 'degraded',
                    responseTime: `${Date.now() - start}ms`,
                    message: `${successful}/${total} RSS feeds working`,
                };
            }

            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            console.log('DEBUG - Exception in checkRSSFeedsHealth:'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkGoogleServicesHealth(): Promise<HealthCheckResponse> {
        console.info('checkGoogleServicesHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();
            const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});
            const results = await Promise.allSettled([
                getOAuth2Client(),  // Test OAuth
                translate.translate('test', {to: 'es'}),    // Test Translate API with a simple translation
            ]);

            const failures = results.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
                return {status: 'unhealthy', error: {message: `${failures.length} Google service(s) failed`, details: failures}};
            }

            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkGeminiAIHealth(): Promise<HealthCheckResponse> {
        console.info('checkGeminiAIHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();
            const model = AIService.genAI.getGenerativeModel({model: AI_SUMMARIZATION_MODELS[0]});
            await model.generateContent('test');
            return {status: 'healthy', responseTime: `${Date.now() - start}ms`};
        } catch (error: any) {
            console.error('ERROR: inside catch of checkGeminiAIHealth:'.red.bold, error);
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }

    static async checkDatabaseHealth(): Promise<HealthCheckResponse> {
        console.info('checkDatabaseHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();

            const dbHealth = getDatabaseHealth();

            if (!dbHealth.connected) {
                return {
                    status: 'unhealthy',
                    error: {message: `Database not connected. State: ${dbHealth.readyState}`},
                    data: dbHealth,
                };
            }

            await mongoose.connection.db!.admin().ping();

            const responseTime = Date.now() - start;
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
            console.error('ERROR: inside catch of checkDatabaseHealth:'.red.bold, error);
            return {
                status: 'unhealthy',
                error: {message: error.message},
                data: getDatabaseHealth(),
            };
        }
    }

    static async checkOverallSystemHealth(): Promise<HealthCheckResponse> {
        console.info('checkOverallSystemHealth called:'.bgMagenta.white.italic);

        try {
            const start = Date.now();

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

            return {
                status: overallStatus,
                responseTime: `${Date.now() - start}ms`,
                data: results,
                message: `${healthyServices}/${totalServices} services healthy`,
            };
        } catch (error: any) {
            return {status: 'unhealthy', error: {message: error.message}};
        }
    }
}

export default HealthService;
