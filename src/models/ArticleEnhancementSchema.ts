import {Document, model, Model, Schema} from 'mongoose';
import {COMPLEXITY_LEVELS, ComplexityLevel, SentimentResult, ImpactLevel, IMPACT_LEVELS} from "../types/ai";
import {ARTICLE_COMPLEXITIES, ArticleComplexities, PROCESSING_STATUSES, ProcessingStatus} from "../types/news";

export interface IArticleEnhancement extends Document {
    articleId: string;
    url: string;
    tags?: string[];
    sentiment?: {
        sentiment: SentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
    complexity?: {
        level: ArticleComplexities;
        readingTimeMinutes: number;
        wordCount: number;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: ComplexityLevel;
        reasoning: string;
    };
    locations?: string[];
    questions?: string[];
    newsInsights?: {
        keyThemes: string[];
        impactAssessment: {
            level: ImpactLevel;
            description: string;
        };
        contextConnections: string[];
        stakeholderAnalysis: {
            winners: string[];
            losers: string[];
            affected: string[];
        };
        timelineContext: string[];
    };
    processingStatus: ProcessingStatus;
    createdAt: Date;
    updatedAt: Date;
}

interface IArticleEnhancementModel extends Model<IArticleEnhancement> {
}

const ArticleEnhancementSchema = new Schema<IArticleEnhancement>({
    articleId: {
        type: String,
        required: true,
        unique: true,
    },
    url: {
        type: String,
        required: true,
    },
    tags: [{
        type: String,
    }],
    sentiment: {
        sentiment: String,
        confidence: Number,
        emoji: String,
        color: String,
    },
    complexity: {
        level: {
            type: String,
            enum: ARTICLE_COMPLEXITIES,
        },
        readingTimeMinutes: Number,
        wordCount: Number,
    },
    keyPoints: [{
        type: String,
    }],
    complexityMeter: {
        level: {
            type: String,
            enum: COMPLEXITY_LEVELS,
        },
        reasoning: String,
    },
    locations: [{
        type: String,
    }],
    questions: [{
        type: String,
    }],
    newsInsights: {
        keyThemes: [{
            type: String,
        }],
        impactAssessment: {
            level: {
                type: String,
                enum: IMPACT_LEVELS,
            },
            description: String,
        },
        contextConnections: [{
            type: String,
        }],
        stakeholderAnalysis: {
            winners: [{
                type: String,
            }],
            losers: [{
                type: String,
            }],
            affected: [{
                type: String,
            }],
        },
        timelineContext: [{
            type: String,
        }],
    },
    processingStatus: {
        type: String,
        default: 'pending',
        enum: PROCESSING_STATUSES,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 2 * 60 * 60, // 2 hours in seconds
        // expires: 7 * 24 * 60 * 60, // 7 days in seconds TODO: Uncomment it, for production, news should be deleted after 7 days
    },
}, {
    timestamps: true,
});

ArticleEnhancementSchema.index({processingStatus: 1});

const ArticleEnhancementModel: IArticleEnhancementModel = model<IArticleEnhancement, IArticleEnhancementModel>('ArticleEnhancement', ArticleEnhancementSchema);

export default ArticleEnhancementModel;
