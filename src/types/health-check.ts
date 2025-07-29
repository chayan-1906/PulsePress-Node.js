/** ------------- API response types ------------- */

export interface HealthCheckResponse {
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
