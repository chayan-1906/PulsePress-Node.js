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

const checkEmailServiceHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkEmailServiceHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkEmailServiceHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Email Service health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Email Service health check has been passed 🎉' : 'Email Service is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Email Service health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'EMAIL_SERVICE_UNHEALTHY',
                errorMsg: 'Email Service health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkEmailServiceHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during Email Service health check!',
        }));
    }
}

const checkWebScrapingServiceHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkWebScrapingServiceHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkWebScrapingServiceHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: Web Scraping Service health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'Web Scraping Service health check has been passed 🎉' : 'Web Scraping Service is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: Web Scraping Service health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'WEB_SCRAPING_SERVICE_UNHEALTHY',
                errorMsg: 'Web Scraping Service health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkWebScrapingServiceHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during Web Scraping Service health check!',
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

const checkAISummarizationHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkAISummarizationHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkAISummarizationHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: AI Summarization Service health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'AI Summarization Service health check has been passed 🎉' : 'AI Summarization Service is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: AI Summarization Service health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'AI_SUMMARIZATION_UNHEALTHY',
                errorMsg: 'AI Summarization Service health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkAISummarizationHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during AI Summarization Service health check!',
        }));
    }
}

const checkHuggingFaceApiHealthController = async (req: Request, res: Response) => {
    console.info('Controller: checkHuggingFaceApiHealthController started'.bgBlue.white.bold);

    try {
        const healthCheck = await HealthService.checkHuggingFaceApiHealth();

        if (healthCheck.status === 'healthy' || healthCheck.status === 'degraded') {
            console.log('SUCCESS: HuggingFace API health check completed'.bgGreen.bold, {status: healthCheck.status});
            res.status(200).send(new ApiResponse({
                success: true,
                message: healthCheck.status === 'healthy' ? 'HuggingFace API health check has been passed 🎉' : 'HuggingFace API is partially healthy ⚠️',
                health: healthCheck,
            }));
        } else {
            console.warn('Health Warning: HuggingFace API health check failed'.yellow, {status: healthCheck.status});
            res.status(503).send(new ApiResponse({
                success: false,
                errorCode: 'HUGGINGFACE_API_UNHEALTHY',
                errorMsg: 'HuggingFace API health check has been failed',
                health: healthCheck,
            }));
        }
    } catch (error: any) {
        console.error('Controller Error: checkHuggingFaceApiHealthController failed'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            error,
            errorMsg: error.message || 'Something went wrong during HuggingFace API health check!',
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
    checkEmailServiceHealthController,
    checkWebScrapingServiceHealthController,
    checkGoogleServicesHealthController,
    checkAISummarizationHealthController,
    checkHuggingFaceApiHealthController,
    checkDatabaseHealthController,
    checkOverallSystemHealthController,
};
