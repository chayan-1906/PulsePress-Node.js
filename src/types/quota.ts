export type TApiService = 'gemini-total' | 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gemini-2.0-flash-lite' | 'gemini-1.5-flash' | 'newsapi' | 'guardian' | 'nytimes' | 'google_translate';
export const API_SERVICES: TApiService[] = ['gemini-total', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'newsapi', 'guardian', 'nytimes', 'google_translate'];

export type TGeminiModel = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gemini-2.0-flash-lite' | 'gemini-1.5-flash';
export const GEMINI_MODELS: TGeminiModel[] = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

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

export interface IGetCurrentCountParams {
    service: TApiService;
}

export interface IHasQuotaAvailableParams {
    service: TApiService;
    requestCount?: number;
}

export interface IReserveQuotaBeforeApiCallParams {
    service: TApiService;
    count?: number;
}

export interface IReserveQuotaForGeminiModelParams {
    modelName: TGeminiModel;
    count?: number;
}

export interface IReserveQuotaForModelFallbackParams {
    primaryModel: string;
    fallbackModels: string[];
    count?: number;
}

export interface IRollbackQuotaReservationParams {
    service: TApiService;
    count: number;
}

export interface ICheckQuotaAvailabilityForBatchOperationParams {
    service: TApiService;
    requestCount: number;
}


/** ------------- API response types ------------- */

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
