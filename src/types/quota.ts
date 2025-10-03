import {AI_MODELS} from "../utils/constants";

export type TApiService =
    'gemini-total'
    | typeof AI_MODELS.GEMINI_25_FLASH_PREVIEW
    | typeof AI_MODELS.GEMINI_25_FLASH_LITE_PREVIEW
    | typeof AI_MODELS.GEMINI_25_FLASH_LITE
    | typeof AI_MODELS.GEMINI_25_FLASH
    | typeof AI_MODELS.GEMINI_20_FLASH
    | typeof AI_MODELS.GEMINI_20_FLASH_LITE
    | typeof AI_MODELS.GEMINI_15_FLASH
    | 'newsapi'
    | 'guardian'
    | 'nytimes'
    | 'google_translate';
export const API_SERVICES: TApiService[] = ['gemini-total', AI_MODELS.GEMINI_25_FLASH_PREVIEW, AI_MODELS.GEMINI_25_FLASH_LITE_PREVIEW, AI_MODELS.GEMINI_25_FLASH_LITE, AI_MODELS.GEMINI_25_FLASH, AI_MODELS.GEMINI_20_FLASH, AI_MODELS.GEMINI_20_FLASH_LITE, AI_MODELS.GEMINI_15_FLASH, 'newsapi', 'guardian', 'nytimes', 'google_translate'];

export type TGeminiModel =
    typeof AI_MODELS.GEMINI_25_FLASH_PREVIEW
    | typeof AI_MODELS.GEMINI_25_FLASH_LITE_PREVIEW
    | typeof AI_MODELS.GEMINI_25_FLASH_LITE
    | typeof AI_MODELS.GEMINI_25_FLASH
    | typeof AI_MODELS.GEMINI_20_FLASH
    | typeof AI_MODELS.GEMINI_20_FLASH_LITE
    | typeof AI_MODELS.GEMINI_15_FLASH;
export const GEMINI_MODELS: TGeminiModel[] = [AI_MODELS.GEMINI_25_FLASH_PREVIEW, AI_MODELS.GEMINI_25_FLASH_LITE_PREVIEW, AI_MODELS.GEMINI_25_FLASH_LITE, AI_MODELS.GEMINI_25_FLASH, AI_MODELS.GEMINI_20_FLASH, AI_MODELS.GEMINI_20_FLASH_LITE, AI_MODELS.GEMINI_15_FLASH];

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

export interface IExecuteWithModelFallbackParams<T> {
    primaryModel: string;
    fallbackModels: string[];
    executeAICall: (modelName: string) => Promise<T>;
    count?: number;
}

export interface ICheckQuotaAvailabilityForBatchOperationParams {
    service: TApiService;
    requestCount: number;
}

export interface IRollbackQuotaReservationParams {
    service: TApiService;
    count: number;
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

export interface IExecuteWithModelFallbackResponse<T> {
    success: boolean;
    result?: T;
    error?: string;
    selectedModel: string;
    attemptedModels: string[];
}

export interface IBatchQuotaCheckResponse {
    maxProcessable: number;
    recommendedBatchSize: number;
    currentQuota: number;
    requestedCount: number;
    service: TApiService;
}
