export interface IDatabaseHealth {
    connected: boolean;
    readyState: string;
    host?: string;
    name?: string;
    connectionCount?: number;
    uptime?: number;
}


/** ------------- API response types ------------- */

export interface IAIModelsWithFallbackResponse {
    success: boolean;
    workingModel?: string;
    responseTime?: number;
    error?: string;
    attemptedModels: string[];
    totalAttempts: number;
}

export interface IHealthCheckResponse {
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime?: string;
    timestamp?: string;
    version?: string;
    environment?: string;
    message?: string;
    data?: any;
    details?: any;
    error?: {
        details?: any;
        message: string;
    };
}


/** ------------- function params ------------- */

export interface IAIModelTestParams {
    models: string[];
    serviceName: string;
    testPrompt?: string;
}
