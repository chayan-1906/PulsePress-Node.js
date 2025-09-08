import "colors";
import {GEMINI_QUOTA_LIMITS} from "../utils/constants";
import ApiQuotaModel, {IApiQuota} from "../models/ApiQuotaSchema";
import {
    API_SERVICES,
    IBatchQuotaCheckResponse,
    IModelFallbackResponse,
    IQuotaIncrementResponse,
    IQuotaReservationResponse,
    IQuotaServiceOptions,
    IQuotaUsageHistory,
    TApiService,
} from "../types/quota";

class QuotaService {
    private static readonly DEFAULT_LIMITS: Record<TApiService, number> = {
        // 'gemini-total': 1000,               // Shared pool across all Gemini models (per planning doc research)
        gemini: 1000,               // Shared pool across all Gemini models (per planning doc research)
        newsapi: 100,               // NewsAPI.org free tier (2025: 100 requests/day + 24hr delay)
        guardian: 5000,             // Guardian API free tier (2025: 5,000 requests/day, 12/second)
        nytimes: 500,               // NYTimes API free tier (2025: 500 requests/day, 5/minute)
        google_translate: 16667,    // Google Translate free tier (2025: 500K chars/month ≈ 16,667/day)
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

        return new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
    }

    // TODO: Need to remove after NewsService migration
    /**
     * Increment API request counter and check if request is allowed
     * Auto-creates new daily record if date has changed
     */
    static async incrementCounter(service: TApiService, incrementBy: number = 1): Promise<IQuotaIncrementResponse> {
        console.log('Service: QuotaService.incrementCounter called'.cyan.italic, {service, incrementBy});

        try {
            const currentDate = this.getCurrentDatePacific();
            const limit = this.DEFAULT_LIMITS[service];

            let quotaRecord = await ApiQuotaModel.findOne({service, date: currentDate});

            if (!quotaRecord) {
                console.log('Database: Creating new daily quota record'.cyan, {service, date: currentDate});
                quotaRecord = new ApiQuotaModel({
                    service,
                    date: currentDate,
                    requestCount: 0,
                    lastResetAt: new Date(),
                });
            }

            const potentialCount = quotaRecord.requestCount + incrementBy;
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);

            if (potentialCount > conservativeLimit) {
                console.warn('Rate Limit: API quota threshold exceeded'.yellow, {service, currentCount: quotaRecord.requestCount, potentialCount, conservativeLimit, limit});

                return {allowed: false, currentCount: quotaRecord.requestCount, limit: conservativeLimit, service, date: currentDate};
            }

            quotaRecord.requestCount += incrementBy;
            quotaRecord.lastResetAt = new Date();
            await quotaRecord.save();

            const warningLimit = Math.floor(limit * this.OPTIONS.warningThreshold);
            if (quotaRecord.requestCount >= warningLimit) {
                console.warn('Rate Limit Warning: Approaching API quota limit'.yellow, {service, currentCount: quotaRecord.requestCount, warningLimit, conservativeLimit});
            }

            console.log('Database: API quota counter incremented'.green.bold, {service, newCount: quotaRecord.requestCount, limit: conservativeLimit});

            return {allowed: true, currentCount: quotaRecord.requestCount, limit: conservativeLimit, service, date: currentDate};
        } catch (error: any) {
            console.error('Service Error: QuotaService.incrementCounter failed'.red.bold, {service, error});

            return {allowed: true, currentCount: 0, limit: this.DEFAULT_LIMITS[service], service, date: this.getCurrentDatePacific()};
        }
    }

    /**
     * Get current usage count for a service today
     */
    static async getCurrentCount(service: TApiService): Promise<number> {
        console.log('Service: QuotaService.getCurrentCount called'.cyan.italic, {service});

        try {
            const currentDate = this.getCurrentDatePacific();

            const quotaRecord = await ApiQuotaModel.findOne({service, date: currentDate});

            const currentCount = quotaRecord ? quotaRecord.requestCount : 0;
            console.log('Database: Current quota count retrieved'.green.bold, {service, currentCount});

            return currentCount;
        } catch (error) {
            console.error('Service Error: QuotaService.getCurrentCount failed'.red.bold, {service, error});
            return 0;
        }
    }

    /**
     * Get usage history for a service over the last N days
     */
    private static async getUsageHistory(service: TApiService, days: number = 7): Promise<IQuotaUsageHistory[]> {
        console.log('Service: QuotaService.getUsageHistory called'.cyan.italic, {service, days});

        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const records: IApiQuota[] = await ApiQuotaModel.find({
                service,
                createdAt: {$gte: startDate, $lte: endDate},
            }).sort({date: -1})
                .limit(days);

            const history: IQuotaUsageHistory[] = records.map(({service, date, requestCount, lastResetAt}: IApiQuota) => ({
                service, date, requestCount, lastResetAt,
            }));

            console.log('Database: Usage history retrieved'.cyan, {service, days, recordCount: history.length});
            return history;
        } catch (error) {
            console.error('Service Error: QuotaService.getUsageHistory failed'.red.bold, {service, days, error});
            return [];
        }
    }

    /**
     * Get total usage across all services today (for monitoring)
     */
    private static async getTodaysTotalUsage(): Promise<Record<TApiService, number>> {
        console.log('Service: QuotaService.getTodaysTotalUsage called'.cyan.italic);

        try {
            const currentDate = this.getCurrentDatePacific();

            const records: IApiQuota[] = await ApiQuotaModel.find({date: currentDate});

            const usage: Record<TApiService, number> = {
                gemini: 0,
                newsapi: 0,
                guardian: 0,
                nytimes: 0,
                google_translate: 0,
            };

            records.forEach(record => {
                usage[record.service] = record.requestCount;
            });

            console.log('Database: Total daily usage retrieved'.cyan, {date: currentDate, usage});
            return usage;
        } catch (error) {
            console.error('Service Error: QuotaService.getTodaysTotalUsage failed'.red.bold, {error});
            return {gemini: 0, newsapi: 0, guardian: 0, nytimes: 0, google_translate: 0};
        }
    }

    /**
     * Check if a service has quota available without incrementing
     */
    static async hasQuotaAvailable(service: TApiService, requestCount: number = 1): Promise<boolean> {
        try {
            const currentDate = this.getCurrentDatePacific();
            const limit = this.DEFAULT_LIMITS[service];
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);

            const quotaRecord: IApiQuota | null = await ApiQuotaModel.findOne({
                service,
                date: currentDate
            });

            const currentCount = quotaRecord ? quotaRecord.requestCount : 0;
            const wouldExceed = (currentCount + requestCount) > conservativeLimit;

            console.log('Service: QuotaService.hasQuotaAvailable checked'.green.bold, {service, currentCount, requestCount, conservativeLimit, available: !wouldExceed});

            return !wouldExceed;
        } catch (error) {
            console.error('Service Error: QuotaService.hasQuotaAvailable failed'.red.bold, {service, error});
            return true;
        }
    }

    /**
     * Get quota limits and current usage for all services (for admin/debugging)
     */
    private static async getQuotaStatus(): Promise<Record<TApiService, { current: number, limit: number, available: number }>> {
        console.log('Service: QuotaService.getQuotaStatus called'.cyan.italic);

        const status: Record<TApiService, { current: number, limit: number, available: number }> = {} as any;

        for (const service of API_SERVICES) {
            try {
                const current = await this.getCurrentCount(service);
                const limit = Math.floor(this.DEFAULT_LIMITS[service] * this.OPTIONS.conservativeThreshold);
                const available = Math.max(0, limit - current);

                status[service] = {current, limit, available};
            } catch (error) {
                console.error('Service Error: QuotaService.getQuotaStatus failed for service'.red.bold, {service, error});
                status[service] = {current: 0, limit: this.DEFAULT_LIMITS[service], available: this.DEFAULT_LIMITS[service]};
            }
        }

        console.log('All quota statuses retrieved successfully'.cyan, {status});
        return status;
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
    static async reserveQuotaBeforeApiCall(service: TApiService, count: number = 1): Promise<IQuotaReservationResponse> {
        console.log('Service: QuotaService.reserveQuotaBeforeApiCall called'.cyan.italic, {service, count});

        try {
            const currentDate = this.getCurrentDatePacific();
            const limit = this.DEFAULT_LIMITS[service];
            const conservativeLimit = Math.floor(limit * this.OPTIONS.conservativeThreshold);

            // CRITICAL SECTION: MongoDB Mutex Implementation
            // This atomic operation prevents race conditions by implementing mutual exclusion
            // Only ONE process can successfully reserve quota when multiple compete simultaneously

            // Try atomic update with quota check - separate logic for existing vs new documents
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
                const existingDoc = await ApiQuotaModel.findOne({service, date: currentDate});

                if (!existingDoc && count <= conservativeLimit) {
                    try {
                        result = await ApiQuotaModel.findOneAndUpdate(
                            {service, date: currentDate},
                            {
                                $setOnInsert: {
                                    requestCount: count,
                                    lastResetAt: new Date(),
                                },
                            },
                            {new: true, upsert: true},
                        );
                    } catch (duplicateError: any) {
                        result = await ApiQuotaModel.findOneAndUpdate(
                            {
                                service,
                                date: currentDate,
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
                const currentRecord: IApiQuota | null = await ApiQuotaModel.findOne({service, date: currentDate});
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

            console.log('Database: Quota reserved successfully'.cyan, {
                service,
                reservedCount: count,
                newTotal: result.requestCount,
                remainingQuota
            });

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
     * Handle Gemini model fallback scenarios with different RPD limits
     * Tries primary model first, then fallbacks in order based on available quota
     */
    static async reserveQuotaForModelFallback(primaryModel: string, fallbackModels: string[], count: number = 1): Promise<IModelFallbackResponse> {
        console.log('Service: QuotaService.reserveQuotaForModelFallback called'.cyan.italic, {primaryModel, fallbackModels, count});

        try {
            const currentDate = this.getCurrentDatePacific();

            const totalQuotaResult = await this.reserveQuotaBeforeApiCall('gemini', count);
            if (!totalQuotaResult.allowed) {
                console.warn('Rate Limit: Total Gemini quota exhausted'.yellow, {remainingQuota: totalQuotaResult.remainingQuota});

                return {allowed: false, selectedModel: '', quotaReserved: 0, service: 'gemini', date: currentDate};
            }

            const modelsToTry: string[] = [primaryModel, ...fallbackModels];

            for (const modelName of modelsToTry) {
                const modelLimit: number = GEMINI_QUOTA_LIMITS[modelName as keyof typeof GEMINI_QUOTA_LIMITS];

                if (!modelLimit) {
                    console.warn('Config Warning: Unknown model limit'.yellow.italic, {modelName});
                    continue;
                }

                const currentCount = await this.getCurrentCount('gemini');

                if (currentCount <= modelLimit) {
                    console.log('Database: Model selected for API call'.cyan, {selectedModel: modelName, modelLimit, currentCount, quotaReserved: count});

                    return {allowed: true, selectedModel: modelName, quotaReserved: count, service: 'gemini', date: currentDate};
                }

                console.log('Model quota check: Model limit exceeded, trying next'.cyan, {modelName, currentCount, modelLimit});
            }

            console.error('Service Error: All Gemini models exhausted despite available total quota'.red.bold, {primaryModel, fallbackModels, totalQuotaAvailable: totalQuotaResult.remainingQuota});

            return {allowed: false, selectedModel: '', quotaReserved: count, service: 'gemini', date: currentDate};
        } catch (error: any) {
            console.error('Service Error: QuotaService.reserveQuotaForModelFallback failed'.red.bold, {primaryModel, fallbackModels, error});

            return {allowed: true, selectedModel: primaryModel, quotaReserved: count, service: 'gemini', date: this.getCurrentDatePacific()};
        }
    }

    /**
     * Pre-filter batch operations to prevent partial processing failures
     * Returns maximum processable items based on available quota
     */
    static async checkQuotaAvailabilityForBatchOperation(service: TApiService, requestCount: number): Promise<IBatchQuotaCheckResponse> {
        console.log('Service: QuotaService.checkQuotaAvailabilityForBatchOperation called'.cyan.italic, {service, requestCount});

        try {
            const currentCount = await this.getCurrentCount(service);
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
