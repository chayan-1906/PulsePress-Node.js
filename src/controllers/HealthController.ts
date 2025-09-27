import "colors";
import {Request, Response} from "express";
import {ApiResponse} from "../utils/ApiResponse";
import HealthService from "../services/HealthService";

const checkNewsApiOrgHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkNewsApiOrgHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkNewsApiOrgHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: News API health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'News API Org health check has been passed 🎉' : 'News API is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: News API Org health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'NEWS_API_UNHEALTHY',
                errorMsg: 'News API health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkNewsApiOrgHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong while checking news api org service status',
        }));
    }
}

const checkGuardianApiHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkGuardianApiHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkGuardianApiHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Guardian API health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Guardian API health check has been passed 🎉' : 'Guardian API is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Guardian API health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'GUARDIAN_API_UNHEALTHY',
                errorMsg: 'Guardian API health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkGuardianApiHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during Guardian API health check!',
        }));
    }
}

const checkRssFeedsHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkRssFeedsHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkRssFeedsHealth();
        console.debug('Debug: RSS health check status'.gray, {status: healthCheck.status, type: typeof healthCheck.status});

        console.debug('Debug: Evaluating health condition'.gray);
        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: RSS feeds health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'RSS Feeds health check has been passed 🎉' : 'RSS feeds are partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: RSS feeds health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'RSS_FEEDS_UNHEALTHY',
                errorMsg: 'RSS Feeds health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.debug('Debug: Caught exception in RSS health check'.gray, {error: error.message});
        console.error('Controller Error: checkRssFeedsHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during rss feeds health check!',
        }));
    }
}

const checkGoogleServicesHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkGoogleServicesHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkGoogleServicesHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Google Services health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Google Services health check has been passed 🎉' : 'Google services are partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Google Services health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'GOOGLE_SERVICES_UNHEALTHY',
                errorMsg: 'Google Services health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkGoogleServicesHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during google services health check!',
        }));
    }
}

const checkGeminiAiHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkGeminiAiHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkGeminiAiHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Gemini AI health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Gemini AI health check has been passed 🎉' : 'Gemini AI is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Gemini AI health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'GEMINI_API_UNHEALTHY',
                errorMsg: 'Gemini AI health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkGeminiAiHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during gemini ai\'s health check!',
        }));
    }
}

const checkNyTimesApiHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkNyTimesApiHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkNyTimesApiHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: NYTimes API health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'NYTimes API health check has been passed 🎉' : 'NYTimes API is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: NYTimes API health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'NYTIMES_API_UNHEALTHY',
                errorMsg: 'NYTimes API health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkNyTimesApiHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during NYTimes API health check!',
        }));
    }
}

const checkDatabaseHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkDatabaseHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkDatabaseHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Database health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Database is operational 🎉' : 'Database is partially operational ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Database health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'DATABASE_UNHEALTHY',
                errorMsg: 'Database health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkDatabaseHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during database health check!',
        }));
    }
}

const checkOverallSystemHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkOverallSystemHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkOverallSystemHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Overall system health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'System health check has been passed 🎉' : 'System is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Overall system health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'SYSTEM_UNHEALTHY',
                errorMsg: 'System health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkOverallSystemHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during overall system health check!',
        }));
    }
}

export {
    checkNewsApiOrgHealthController,
    checkGuardianApiHealthController,
    checkNyTimesApiHealthController,
    checkRssFeedsHealthController,
    checkGoogleServicesHealthController,
    checkGeminiAiHealthController,
    checkDatabaseHealthController,
    checkOverallSystemHealthController,
};
