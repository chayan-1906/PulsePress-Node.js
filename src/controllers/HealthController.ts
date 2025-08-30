import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import HealthService from "../services/HealthService";

const checkNewsAPIOrgHealthController = async (req: Request, res: Response) => {
    console.info('checkNewsAPIHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkNewsAPIOrgHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'News API health check passed 🎉' : 'News API partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'NEWS_API_UNHEALTHY',
                errorMsg: 'News API health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of topHeadlines:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while checking news api org health!',
        }));
    }
}

const checkRSSFeedsHealthController = async (req: Request, res: Response) => {
    console.info('checkRSSFeedsHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkRSSFeedsHealth();
        console.debug('DEBUG - healthCheck.status:', JSON.stringify(healthCheck.status), 'Type:', typeof healthCheck.status);

        console.log('DEBUG - About to check condition');
        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('DEBUG - Condition passed, sending success');
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'RSS Feeds health check passed 🎉' : 'RSS feeds partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.log('DEBUG - Condition failed, sending error'.red.bold);
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'RSS_FEEDS_UNHEALTHY',
                errorMsg: 'RSS Feeds health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('DEBUG - Hit catch block:'.red.bold, error);
        console.error('ERROR: inside catch of checkRSSFeedsHealthController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong while checking rss feeds health!',
        }));
    }
}

const checkGoogleServicesHealthController = async (req: Request, res: Response) => {
    console.info('checkGoogleServicesHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkGoogleServicesHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Google Services health check passed 🎉' : 'Google services partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'GOOGLE_SERVICES_UNHEALTHY',
                errorMsg: 'Google Services health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of checkGoogleServicesHealthController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong while checking google services health!',
        }));
    }
}

const checkGeminiAIHealthController = async (req: Request, res: Response) => {
    console.info('checkGeminiAIHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkGeminiAIHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Gemini AI health check passed 🎉' : 'Gemini AI partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'GEMINI_API_UNHEALTHY',
                errorMsg: 'Gemini AI health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of checkGeminiAIHealthController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong while checking gemini ai\'s health!',
        }));
    }
}

const checkDatabaseHealthController = async (req: Request, res: Response) => {
    console.info('checkDatabaseHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkDatabaseHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Database is operational 🎉' : 'Database is partially operational ⚠️',
                health: healthCheck,
            }));
        } else {
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'DATABASE_UNHEALTHY',
                errorMsg: 'Database health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of checkDatabaseHealthController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong while checking database health!',
        }));
    }
}

const checkOverallSystemHealthController = async (req: Request, res: Response) => {
    console.info('checkOverallSystemHealthController called'.bgMagenta.white.italic);
    try {
        const healthCheck = await HealthService.checkOverallSystemHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'System health check passed 🎉' : 'System partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'SYSTEM_UNHEALTHY',
                errorMsg: 'System health check failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('ERROR: inside catch of checkOverallSystemHealthController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: 'Something went wrong while checking overall system health!',
        }));
    }
}

export {
    checkNewsAPIOrgHealthController,
    checkRSSFeedsHealthController,
    checkGoogleServicesHealthController,
    checkGeminiAIHealthController,
    checkDatabaseHealthController,
    checkOverallSystemHealthController,
};
