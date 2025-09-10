import "colors";
import ApiQuotaModel, {IApiQuota} from "../models/ApiQuotaSchema";
import {
    API_SERVICES,
    GEMINI_MODELS,
    IBatchQuotaCheckResponse,
    ICheckQuotaAvailabilityForBatchOperationParams,
    IGetCurrentCountParams,
    IHasQuotaAvailableParams,
    IModelFallbackResponse,
    IQuotaReservationResponse,
    IQuotaServiceOptions,
    IReserveQuotaBeforeApiCallParams,
    IReserveQuotaForGeminiModelParams,
    IReserveQuotaForModelFallbackParams,
    IRollbackQuotaReservationParams,
    TApiService,
    TGeminiModel,
} from "../types/quota";

class QuotaService {
    private static readonly DEFAULT_LIMITS: Record<TApiService, number> = {
        'gemini-total': 900,                    // Shared pool across all Gemini models
        'gemini-2.5-flash-lite': 900,           // 1000 RPD * 0.9
        'gemini-2.5-flash': 225,                // 250 RPD * 0.9
        'gemini-2.0-flash': 180,                // 200 RPD * 0.9
        'gemini-2.0-flash-lite': 180,           // 200 RPD * 0.9
        'gemini-1.5-flash': 90,                 // 100 RPD * 0.9
        newsapi: 100,                           // NewsAPI.org free tier (2025: 100 requests/day + 24hr delay)
        guardian: 5000,                         // Guardian API free tier (2025: 5,000 requests/day, 12/second)
        nytimes: 500,                           // NYTimes API free tier (2025: 500 requests/day, 5/minute)
        google_translate: 16667,                // Google Translate free tier (2025: 500K chars/month ≈ 16,667/day)
    };
    private static readonly OPTIONS: IQuotaServiceOptions = {
        conservativeThreshold: 0.9, // Block at 90% usage
        warningThreshold: 0.8,      // Warn at 80% usage
    };

    /**
     * Get current Pacific Time date string (YYYY-MM-DD)
     * Google's quotas reset at midnight Pacific time
     */
    private static getCurrentDatePacific(): string {
        console.log('Service: QuotaService.getCurrentDatePacific called'.cyan.italic);

        const pacificDate = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        console.log('Current Pacific date:'.cyan, pacificDate);

        return pacificDate;
    }

    /**
     * Get or reset daily quota record for a service
     * Resets requestCount to 0 if date has changed (after Pacific midnight)
     */
    private static async getOrResetDailyRecord(service: TApiService): Promise<IApiQuota> {
        const currentDate = this.getCurrentDatePacific();

        let record = await ApiQuotaModel.findOne({service});

        if (!record) {
            record = new ApiQuotaModel({
                service,
                date: currentDate,
                requestCount: 0,
                lastResetAt: new Date(),
            });
            await record.save();
            console.log('Database: Created new quota record'.cyan, {service, date: currentDate});
        } else if (record.date !== currentDate) {
            record.date = currentDate;
            record.requestCount = 0;
            record.lastResetAt = new Date();
            await record.save();
            console.log('Database: Reset quota record for new day'.cyan, {service, date: currentDate});
        }

        return record;
    }

    /**
     * Initialize all 10 fixed quota records on application startup
     * Ensures exactly 10 permanent records exist for all API services
     */
    static async initializeQuotaRecords(): Promise<void> {
        console.log('Service: QuotaService.initializeQuotaRecords called'.cyan.italic);

        try {
            const currentDate = this.getCurrentDatePacific();
            const promises: Promise<void>[] = [];

            for (const service of API_SERVICES) {
                const promise = (async () => {
                    const existingQuota = await ApiQuotaModel.findOne({service});
                    if (!existingQuota) {
                        const newQuota = new ApiQuotaModel({
                            service,
                            date: currentDate,
                            requestCount: 0,
                            lastResetAt: new Date(),
                        });
                        await newQuota.save();
                        console.log('Database: Initialized quota record'.cyan, {service, date: currentDate});
                    }
                })();
                promises.push(promise);
            }

            await Promise.all(promises);
            console.log('Quota records initialization completed successfully'.green.bold, {totalRecords: API_SERVICES.length});
        } catch (error: any) {
            console.error('Service Error: QuotaService.initializeQuotaRecords failed'.red.bold, error);
            throw error;
        }
    }

    /**
     * Get current usage count for a service today
     */
    static async getCurrentCount({service}: IGetCurrentCountParams): Promise<number> {
        console.log('Service: QuotaService.getCurrentCount called'.cyan.italic, {service});

        try {
            const record = await this.getOrResetDailyRecord(service);
            console.log('Database: Current quota count retrieved'.green.bold, {service, currentCount: record.requestCount});
            return record.requestCount;
        } catch (error) {
            console.error('Service Error: QuotaService.getCurrentCount failed'.red.bold, {service, error});
            return 0;
        }
    }

    /**
     * Check if a service has quota available without incrementing
     */
    static async hasQuotaAvailable({service, requestCount = 1}: IHasQuotaAvailableParams): Promise<boolean> {
        try {
            const limit = this.DEFAULT_LIMITS[service];
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);

            const record = await this.getOrResetDailyRecord(service);
            const wouldExceed: boolean = (record.requestCount + requestCount) > conservativeLimit;

            console.log('Service: QuotaService.hasQuotaAvailable checked'.green.bold, {service, currentCount: record.requestCount, requestCount, conservativeLimit, available: !wouldExceed});

            return !wouldExceed;
        } catch (error) {
            console.error('Service Error: QuotaService.hasQuotaAvailable failed'.red.bold, {service, error});
            return true;
        }
    }

    /**
     * Atomically reserve quota slots before making API calls to prevent race conditions
     *
     * CRITICAL SECTION IMPLEMENTATION:
     * Uses MongoDB document-level locking to implement Mutual Exclusion (Mutex)
     * preventing race conditions in distributed systems. This solves the classic
     * Operating Systems problem of multiple processes competing for shared resources
     *
     * Pre-increment pattern: Reserve quota BEFORE calling external API
     * - Eliminates check-then-call race condition window
     * - Guarantees billing safety even with concurrent requests
     * - Uses atomic findOneAndUpdate for thread-safe quota reservation
     */
    static async reserveQuotaBeforeApiCall({service, count = 1}: IReserveQuotaBeforeApiCallParams): Promise<IQuotaReservationResponse> {
        console.log('Service: QuotaService.reserveQuotaBeforeApiCall called'.cyan.italic, {service, count});

        try {
            const currentDate = this.getCurrentDatePacific();
            const limit = this.DEFAULT_LIMITS[service];
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);

            // CRITICAL SECTION: Atomic reset + reservation with quota check
            let result: IApiQuota | null = await ApiQuotaModel.findOneAndUpdate(
                {
                    service,
                    date: currentDate,
                    requestCount: {$lte: conservativeLimit - count}, // Only if quota available
                },
                {
                    $inc: {requestCount: count},
                    $set: {lastResetAt: new Date()},
                },
                {new: true},
            );

            if (!result) {
                const existingQuota = await ApiQuotaModel.findOne({service});
                console.log('Debug: First query failed, checking existing record'.yellow, {
                    service,
                    existingQuota: existingQuota ? {date: existingQuota.date, requestCount: existingQuota.requestCount} : null,
                    currentDate
                });

                if (existingQuota && existingQuota.date !== currentDate) {
                    console.log('Database: Resetting quota record for new day'.cyan, {service, oldDate: existingQuota.date, newDate: currentDate});

                    if (count <= conservativeLimit) {
                        result = await ApiQuotaModel.findOneAndUpdate(
                            {service, date: existingQuota.date},
                            {
                                $set: {
                                    date: currentDate,
                                    requestCount: count,
                                    lastResetAt: new Date(),
                                },
                            },
                            {new: true},
                        );
                    }
                } else if (!existingQuota && count <= conservativeLimit) {
                    try {
                        const newQuota = new ApiQuotaModel({
                            service,
                            date: currentDate,
                            requestCount: count,
                            lastResetAt: new Date(),
                        });
                        result = await newQuota.save();
                        console.log('Database: Created new quota record'.cyan, {service, date: currentDate});
                    } catch (duplicateError: any) {
                        result = await ApiQuotaModel.findOneAndUpdate(
                            {
                                service,
                                requestCount: {$lte: conservativeLimit - count},
                            },
                            {
                                $inc: {requestCount: count},
                                $set: {lastResetAt: new Date()},
                            },
                            {new: true},
                        );
                    }
                }
            }

            if (!result) {
                const currentRecord = await ApiQuotaModel.findOne({service});
                const currentCount = currentRecord?.requestCount || 0;

                console.warn('Rate Limit: Quota reservation failed - insufficient quota'.yellow, {service, currentCount, requestedCount: count, limit: conservativeLimit});

                return {
                    allowed: false,
                    reservedCount: 0,
                    remainingQuota: Math.max(0, conservativeLimit - currentCount),
                    service,
                    date: currentDate,
                };
            }

            const remainingQuota = Math.max(0, conservativeLimit - result.requestCount);

            console.log('Database: Quota reserved successfully'.cyan, {service, reservedCount: count, newTotal: result.requestCount, remainingQuota});

            const warningLimit = Math.floor(limit * this.OPTIONS.warningThreshold);
            if (result.requestCount >= warningLimit) {
                console.warn('Rate Limit Warning: Approaching API quota limit after reservation'.yellow, {service, currentCount: result.requestCount, warningLimit, conservativeLimit});
            }

            return {allowed: true, reservedCount: count, remainingQuota, service, date: currentDate};
        } catch (error: any) {
            console.error('Service Error: QuotaService.reserveQuotaBeforeApiCall failed'.red.bold, {service, count, error});

            return {allowed: true, reservedCount: count, remainingQuota: this.DEFAULT_LIMITS[service], service, date: this.getCurrentDatePacific()};
        }
    }

    /**
     * DUAL-LEVEL QUOTA ENFORCEMENT for Gemini Models
     *
     * Enforces TWO constraints simultaneously:
     * 1. Global Pool: gemini-total ≤ 900 (sum of all individual model usage)
     * 2. Individual Model: each model ≤ its specific limit
     *
     * This ensures billing safety by preventing any model from exceeding Google's free tier limits
     */
    static async reserveQuotaForGeminiModel({modelName, count = 1}: IReserveQuotaForGeminiModelParams): Promise<IModelFallbackResponse> {
        console.log('Service: QuotaService.reserveQuotaForGeminiModel called'.cyan.italic, {modelName, count});

        try {
            const currentDate = this.getCurrentDatePacific();

            const modelLimit = this.DEFAULT_LIMITS[modelName];
            if (!modelLimit) {
                console.error('Service Error: Unknown Gemini model'.red.bold, {modelName});
                return {allowed: false, selectedModel: '', quotaReserved: 0, service: modelName, date: currentDate};
            }

            const modelQuotaResult = await this.reserveQuotaBeforeApiCall({service: modelName, count});
            if (!modelQuotaResult.allowed) {
                console.warn('Rate Limit: Individual model quota exhausted'.yellow, {modelName, remainingQuota: modelQuotaResult.remainingQuota, modelLimit});
                return {allowed: false, selectedModel: '', quotaReserved: 0, service: modelName, date: currentDate};
            }

            const totalQuotaResult = await this.reserveQuotaBeforeApiCall({service: 'gemini-total', count});
            if (!totalQuotaResult.allowed) {
                console.warn('Rate Limit: Total Gemini quota exhausted'.yellow, {remainingQuota: totalQuotaResult.remainingQuota});

                await this.rollbackQuotaReservation({service: modelName, count});

                return {allowed: false, selectedModel: '', quotaReserved: 0, service: 'gemini-total', date: currentDate};
            }

            console.log('Database: Dual-level quota reserved successfully'.green.bold, {
                selectedModel: modelName,
                quotaReserved: count,
                modelRemaining: modelQuotaResult.remainingQuota,
                totalRemaining: totalQuotaResult.remainingQuota
            });

            return {allowed: true, selectedModel: modelName, quotaReserved: count, service: modelName, date: currentDate};
        } catch (error: any) {
            console.error('Service Error: QuotaService.reserveQuotaForGeminiModel failed'.red.bold, {modelName, count, error});
            return {allowed: false, selectedModel: '', quotaReserved: 0, service: modelName, date: this.getCurrentDatePacific()};
        }
    }

    /**
     * Handle Gemini model fallback scenarios with dual-level quota enforcement
     * Tries primary model first, then fallbacks in order based on available quota
     */
    static async reserveQuotaForModelFallback({primaryModel, fallbackModels, count = 1}: IReserveQuotaForModelFallbackParams): Promise<IModelFallbackResponse> {
        console.log('Service: QuotaService.reserveQuotaForModelFallback called'.cyan.italic, {primaryModel, fallbackModels, count});

        const modelsToTry: string[] = [primaryModel, ...fallbackModels];

        for (const modelName of modelsToTry) {
            if (!GEMINI_MODELS.includes(modelName as TGeminiModel)) {
                console.warn('Config Warning: Unknown Gemini model'.yellow.italic, {modelName});
                continue;
            }

            const result = await this.reserveQuotaForGeminiModel({modelName: modelName as TGeminiModel, count});
            if (result.allowed) {
                console.log('Model fallback: Successfully reserved quota'.cyan, {selectedModel: modelName, quotaReserved: count});
                return result;
            }

            console.log('Model fallback: Model unavailable, trying next'.cyan, {modelName, reason: result.service});
        }

        console.error('Service Error: All Gemini models exhausted'.red.bold, {primaryModel, fallbackModels});
        return {allowed: false, selectedModel: '', quotaReserved: 0, service: 'gemini-total', date: this.getCurrentDatePacific()};
    }

    /**
     * Rollback quota reservation in case of partial failure
     * Used when individual model quota succeeds but global quota fails
     */
    private static async rollbackQuotaReservation({service, count}: IRollbackQuotaReservationParams): Promise<void> {
        console.log('Service: QuotaService.rollbackQuotaReservation called'.cyan.italic, {service, count});

        try {
            await ApiQuotaModel.findOneAndUpdate(
                {service},
                {
                    $inc: {requestCount: -count},
                    $set: {lastResetAt: new Date()},
                },
                {new: true},
            );

            console.log('Database: Quota reservation rolled back'.cyan, {service, rolledBackCount: count});
        } catch (error) {
            console.error('Service Error: QuotaService.rollbackQuotaReservation failed'.red.bold, {service, count, error});
        }
    }

    /**
     * Pre-filter batch operations to prevent partial processing failures
     * Returns maximum processable items based on available quota
     */
    static async checkQuotaAvailabilityForBatchOperation({service, requestCount}: ICheckQuotaAvailabilityForBatchOperationParams): Promise<IBatchQuotaCheckResponse> {
        console.log('Service: QuotaService.checkQuotaAvailabilityForBatchOperation called'.cyan.italic, {service, requestCount});

        try {
            const currentCount = await this.getCurrentCount({service});
            const limit = this.DEFAULT_LIMITS[service];
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);
            const availableQuota = Math.max(0, conservativeLimit - currentCount);

            const maxProcessable = Math.min(requestCount, availableQuota);
            const recommendedBatchSize = Math.min(50, Math.max(1, Math.floor(availableQuota * 0.8)));

            console.log('Database: Batch quota availability calculated'.cyan, {service, currentCount, availableQuota, requestCount, maxProcessable, recommendedBatchSize});

            if (maxProcessable < requestCount) {
                console.warn('Rate Limit Warning: Requested batch size exceeds available quota'.yellow, {service, requestedCount: requestCount, maxProcessable, availableQuota});
            }

            return {maxProcessable, recommendedBatchSize, currentQuota: availableQuota, requestedCount: requestCount, service};
        } catch (error: any) {
            console.error('Service Error: QuotaService.checkQuotaAvailabilityForBatchOperation failed'.red.bold, {service, requestCount, error});

            return {maxProcessable: requestCount, recommendedBatchSize: Math.min(requestCount, 50), currentQuota: this.DEFAULT_LIMITS[service], requestedCount: requestCount, service};
        }
    }
}

export default QuotaService;
