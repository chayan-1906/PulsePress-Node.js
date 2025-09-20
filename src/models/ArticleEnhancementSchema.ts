import {Document, model, Model, Schema} from 'mongoose';
import {ARTICLE_COMPLEXITIES, PROCESSING_STATUSES, TArticleComplexities, TProcessingStatus} from "../types/news";
import {
    COMPLEXITY_LEVELS,
    IMPACT_LEVELS,
    SOCIAL_MEDIA_CAPTION_STYLES,
    SUMMARIZATION_STYLES,
    TComplexityLevel,
    TImpactLevel,
    TSentimentResult,
    TSocialMediaCaptionStyle,
    TSocialMediaPlatform,
    TSummarizationStyle,
    TSupportedLanguage,
} from "../types/ai";

export interface IArticleEnhancement extends Document {
    articleId: string;
    url: string;
    tags?: string[];
    sentiment?: {
        type: TSentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
    complexity?: {
        level: TArticleComplexities;
        readingTimeMinutes: number;
        wordCount: number;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: TComplexityLevel;
        reasoning: string;
    };
    locations?: string[];
    questions?: string[];
    summaries?: Map<string, {
        content: string;
        style: TSummarizationStyle;
        language: TSupportedLanguage;
        createdAt: Date;
    }>;
    socialMediaCaptions?: Map<string, {
        content: string;
        style: TSocialMediaCaptionStyle;
        platform?: TSocialMediaPlatform;
        createdAt: Date;
    }>;
    newsInsights?: {
        keyThemes: string[];
        impactAssessment: {
            level: TImpactLevel;
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
    processingStatus: TProcessingStatus;
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
        type: {
            type: String,
        },
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
    summaries: {
        type: Map,
        of: {
            content: {
                type: String,
                required: true,
            },
            style: {
                type: String,
                enum: SUMMARIZATION_STYLES,
                required: true,
            },
            language: {
                type: String,
                required: true,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    },
    socialMediaCaptions: {
        type: Map,
        of: {
            content: {
                type: String,
                required: true,
            },
            style: {
                type: String,
                enum: SOCIAL_MEDIA_CAPTION_STYLES,
                required: true,
            },
            platform: {
                type: String,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    },
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
