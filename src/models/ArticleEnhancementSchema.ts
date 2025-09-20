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
import {TIME_CONSTANTS} from "../utils/constants";

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
    tags: {
        type: [String],
        default: undefined,
    },
    sentiment: {
        type: new Schema({
            type: {type: String},
            confidence: Number,
            emoji: String,
            color: String,
        }, {_id: false}),
        default: undefined,
    },
    complexity: {
        type: new Schema({
            level: {
                type: String,
                enum: ARTICLE_COMPLEXITIES,
            },
            readingTimeMinutes: Number,
            wordCount: Number,
        }, {_id: false}),
        default: undefined,
    },
    keyPoints: {
        type: [String],
        default: undefined,
    },
    complexityMeter: {
        type: new Schema({
            level: {
                type: String,
                enum: COMPLEXITY_LEVELS,
            },
            reasoning: String,
        }, {_id: false}),
        default: undefined,
    },
    locations: {
        type: [String],
        default: undefined,
    },
    questions: {
        type: [String],
        default: undefined,
    },
    summaries: {
        type: Map,
        of: new Schema({
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
        }, {_id: false}),
        default: undefined,
    },
    socialMediaCaptions: {
        type: Map,
        of: new Schema({
            content: {
                type: String,
                required: true,
            },
            style: {
                type: String,
                enum: SOCIAL_MEDIA_CAPTION_STYLES,
                required: true,
            },
            platform: {type: String},
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }, {_id: false}),
        default: undefined,
    },
    newsInsights: {
        type: new Schema({
            keyThemes: {
                type: [String],
                default: undefined,
            },
            impactAssessment: {
                level: {type: String, enum: IMPACT_LEVELS},
                description: String,
            },
            contextConnections: {
                type: [String],
                default: undefined,
            },
            stakeholderAnalysis: {
                winners: {
                    type: [String],
                    default: undefined,
                },
                losers: {
                    type: [String],
                    default: undefined,
                },
                affected: {
                    type: [String],
                    default: undefined,
                },
            },
            timelineContext: {
                type: [String],
                default: undefined,
            },
        }, {_id: false}),
        default: undefined,
    },
    processingStatus: {
        type: String,
        default: 'pending',
        enum: PROCESSING_STATUSES,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: TIME_CONSTANTS.MONTH_IN_MS,
    },
}, {
    timestamps: true,
    minimize: true, // strips empty {}
});

ArticleEnhancementSchema.index({processingStatus: 1});

const ArticleEnhancementModel: IArticleEnhancementModel = model<IArticleEnhancement, IArticleEnhancementModel>('ArticleEnhancement', ArticleEnhancementSchema);

export default ArticleEnhancementModel;
