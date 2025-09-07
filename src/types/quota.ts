export type TApiService = 'gemini' | 'newsapi' | 'guardian' | 'nytimes' | 'google_translate';
export const API_SERVICES: TApiService[] = ['gemini', 'newsapi', 'guardian', 'nytimes', 'google_translate'];

export interface IQuotaUsageHistory {
    service: TApiService;
    date: string;
    requestCount: number;
    lastResetAt: Date;
}

export interface IQuotaServiceOptions {
    conservativeThreshold: number;  // e.g., 0.9 for 90% threshold
    warningThreshold: number;       // e.g., 0.8 for 80% warning
}


/** ------------- function params ------------- */


/** ------------- API response types ------------- */

export interface IQuotaIncrementResponse {
    allowed: boolean;
    currentCount: number;
    limit: number;
    service: TApiService;
    date: string;
}

export interface IQuotaReservationResponse {
    allowed: boolean;
    reservedCount: number;
    remainingQuota: number;
    service: TApiService;
    date: string;
}

export interface IModelFallbackResponse {
    allowed: boolean;
    selectedModel: string;
    quotaReserved: number;
    service: TApiService;
    date: string;
}

export interface IBatchQuotaCheckResponse {
    maxProcessable: number;
    recommendedBatchSize: number;
    currentQuota: number;
    requestedCount: number;
    service: TApiService;
}
