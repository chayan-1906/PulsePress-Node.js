import "colors";
import {DEFAULT_ENGAGEMENT_WEIGHTS} from "../utils/constants";
import SourceAnalyticsModel, {ISourceAnalytics} from "../models/SourceAnalyticsSchema";
import {
    GetSourceAnalyticsParams,
    GetSourceAnalyticsResponse,
    GetTopPerformingSourcesParams,
    GetTopPerformingSourcesResponse,
    UpdateSourceAnalyticsParams,
    UpdateSourceAnalyticsResponse,
} from "../types/analytics";

class AnalyticsService {
    static async updateSourceAnalytics({source, action, readingTime = 0}: UpdateSourceAnalyticsParams): Promise<UpdateSourceAnalyticsResponse> {
        try {
            if (!source) {
                return {error: 'SOURCE_MISSING'};
            }

            const existingAnalytics = await SourceAnalyticsModel.findOne({source});

            if (!existingAnalytics) {
                const newAnalytics = await this.createInitialAnalytics(source, action, readingTime);
                return {sourceAnalytics: newAnalytics, isUpdated: true};
            }

            const updatedAnalytics = await this.updateExistingAnalytics(existingAnalytics, action, readingTime);
            return {sourceAnalytics: updatedAnalytics, isUpdated: true};
        } catch (error: any) {
            console.error('ERROR: updateSourceAnalytics:'.red.bold, error);
            throw error;
        }
    }

    private static async createInitialAnalytics(source: string, action: string, readingTime: number): Promise<ISourceAnalytics> {
        const initialData = {
            source,
            totalViews: action === 'view' ? 1 : 0,
            totalBookmarks: action === 'bookmark' ? 1 : 0,
            totalCompletedReads: action === 'complete' ? 1 : 0,
            totalReadingTime: readingTime,
            averageReadingTime: readingTime,
            bookmarkConversionRate: action === 'bookmark' ? 100 : 0,
            completionRate: action === 'complete' ? 100 : 0,
            engagementScore: 0,
        };

        initialData.engagementScore = this.calculateEngagementScore(initialData);
        return await SourceAnalyticsModel.create(initialData);
    }

    private static async updateExistingAnalytics(analytics: ISourceAnalytics, action: string, readingTime: number): Promise<ISourceAnalytics> {
        const updates: any = {};

        switch (action) {
            case 'view':
                updates.totalViews = analytics.totalViews + 1;
                updates.totalReadingTime = analytics.totalReadingTime + readingTime;
                break;
            case 'bookmark':
                updates.totalBookmarks = analytics.totalBookmarks + 1;
                break;
            case 'unbookmark':
                updates.totalBookmarks = Math.max(0, analytics.totalBookmarks - 1);
                break;
            case 'complete':
                updates.totalCompletedReads = analytics.totalCompletedReads + 1;
                updates.totalReadingTime = analytics.totalReadingTime + readingTime;
                break;
        }

        // Recalculate derived metrics
        const newTotalViews = updates.totalViews || analytics.totalViews;
        const newTotalBookmarks = updates.totalBookmarks || analytics.totalBookmarks;
        const newTotalCompletedReads = updates.totalCompletedReads || analytics.totalCompletedReads;
        const newTotalReadingTime = updates.totalReadingTime || analytics.totalReadingTime;

        updates.averageReadingTime = newTotalViews > 0 ? newTotalReadingTime / newTotalViews : 0;
        updates.bookmarkConversionRate = newTotalViews > 0 ? (newTotalBookmarks / newTotalViews) * 100 : 0;
        updates.completionRate = newTotalViews > 0 ? (newTotalCompletedReads / newTotalViews) * 100 : 0;
        updates.engagementScore = this.calculateEngagementScore({
            totalViews: newTotalViews,
            totalBookmarks: newTotalBookmarks,
            totalCompletedReads: newTotalCompletedReads,
            totalReadingTime: newTotalReadingTime,
            averageReadingTime: updates.averageReadingTime,
            bookmarkConversionRate: updates.bookmarkConversionRate,
            completionRate: updates.completionRate,
        });

        return await SourceAnalyticsModel.findOneAndUpdate(
            {source: analytics.source},
            {$set: updates},
            {new: true, runValidators: true},
        ) as ISourceAnalytics;
    }

    private static calculateEngagementScore(metrics: any): number {
        const {viewWeight, bookmarkWeight, completionWeight, readingTimeWeight} = DEFAULT_ENGAGEMENT_WEIGHTS;

        const viewScore = metrics.totalViews * viewWeight;
        const bookmarkScore = metrics.totalBookmarks * bookmarkWeight;
        const completionScore = metrics.totalCompletedReads * completionWeight;
        const readingTimeScore = (metrics.totalReadingTime / 60) * readingTimeWeight; // Convert to minutes

        return Math.round(viewScore + bookmarkScore + completionScore + readingTimeScore);
    }

    static async getSourceAnalytics({limit = 20, sortBy = 'engagementScore', sortOrder = 'desc'}: GetSourceAnalyticsParams): Promise<GetSourceAnalyticsResponse> {
        try {
            const sortDirection = sortOrder === 'asc' ? 1 : -1;
            const sourceAnalytics = await SourceAnalyticsModel
                .find({})
                .sort({[sortBy]: sortDirection})
                .limit(limit);

            const totalSources = await SourceAnalyticsModel.countDocuments({});

            return {sourceAnalytics, totalSources};
        } catch (error: any) {
            console.error('ERROR: getSourceAnalytics:'.red.bold, error);
            throw error;
        }
    }

    static async getTopPerformingSources({limit = 10, minViews = 10}: GetTopPerformingSourcesParams): Promise<GetTopPerformingSourcesResponse> {
        try {
            const topSources = await SourceAnalyticsModel
                .find({totalViews: {$gte: minViews}})
                .sort({engagementScore: -1})    // descending order
                .limit(limit);

            const totalSources = await SourceAnalyticsModel.countDocuments({totalViews: {$gte: minViews}});

            return {topSources, totalSources};
        } catch (error: any) {
            console.error('ERROR: getTopPerformingSources:'.red.bold, error);
            throw error;
        }
    }
}

export default AnalyticsService;
