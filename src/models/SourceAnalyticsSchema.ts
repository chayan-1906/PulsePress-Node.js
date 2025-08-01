import {Document, Model, model, Schema} from "mongoose";

export interface ISourceAnalytics extends Document {
    sourceAnalyticsId: string;
    source: string;                    // e.g., 'techcrunch', 'bbc_tech', etc.
    totalViews: number;               // Total articles viewed from this source
    totalBookmarks: number;           // Total articles bookmarked from this source
    totalCompletedReads: number;      // Total articles completed from this source
    totalReadingTime: number;         // Total reading time in seconds
    averageReadingTime: number;       // Average reading time per article
    bookmarkConversionRate: number;   // (bookmarks / views) * 100
    completionRate: number;           // (completed / views) * 100
    engagementScore: number;          // Calculated score based on all metrics
    createdAt: Date;
    updatedAt: Date;
}

interface ISourceAnalyticsModel extends Model<ISourceAnalytics> {
}

const SourceAnalyticsSchema = new Schema<ISourceAnalytics>({
    source: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    totalViews: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalBookmarks: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalCompletedReads: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalReadingTime: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    averageReadingTime: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    bookmarkConversionRate: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
    },
    completionRate: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
    },
    engagementScore: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.sourceAnalyticsId = String(ret._id);
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;

            return ret;
        },
    }
});

SourceAnalyticsSchema.index({engagementScore: -1}); // For sorting by engagement

const SourceAnalyticsModel: ISourceAnalyticsModel = model<ISourceAnalytics, ISourceAnalyticsModel>('SourceAnalytics', SourceAnalyticsSchema);

export default SourceAnalyticsModel;
