import {Document, Model, model, Schema} from "mongoose";
import {TIME_CONSTANTS} from "../utils/constants";
import {SENTIMENT_TYPES, SOCIAL_MEDIA_CAPTION_STYLES, SUMMARIZATION_STYLES, TSocialMediaCaptionStyle, TSummarizationStyle} from "../types/ai";

export interface ICachedArticleEnhancement extends Document {
    contentHash: string;
    tags?: string[];
    sentiment?: {
        type: string;
        confidence: number;
        emoji: string;
        color: string;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: 'easy' | 'medium' | 'hard';
        reasoning: string;
    };
    locations?: string[];
    summary?: {
        content: string;
        style: TSummarizationStyle;
        language: string;
    };
    socialMediaCaption?: {
        content: string;
        style: TSocialMediaCaptionStyle;
    };
    questions?: string[];
    answers?: Map<string, string>;
    newsInsights?: {
        keyThemes: string[];
        impactAssessment: {
            level: string;
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
    createdAt: Date;
    expiresAt: Date;
}

interface ICachedArticleEnhancementModel extends Model<ICachedArticleEnhancement> {
}

const CachedArticleEnhancementSchema = new Schema<ICachedArticleEnhancement>({
    contentHash: {
        type: String,
        unique: true,
        required: true,
        index: true,
    },
    tags: {
        type: [String],
    },
    sentiment: {
        type: {
            type: {
                type: String,
                enum: SENTIMENT_TYPES,
            },
            confidence: {
                type: Number,
                min: 0,
                max: 1,
            },
            emoji: String,
            color: String,
        },
    },
    keyPoints: {
        type: [String],
    },
    complexityMeter: {
        type: {
            level: {
                type: String,
                enum: ['easy', 'medium', 'hard'],
            },
            reasoning: String,
        },
    },
    locations: {
        type: [String],
    },
    summary: {
        type: {
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
        },
    },
    socialMediaCaption: {
        type: {
            content: {
                type: String,
                required: true,
            },
            style: {
                type: String,
                required: true,
                enum: SOCIAL_MEDIA_CAPTION_STYLES,
            },
        },
    },
    questions: {
        type: [String],
    },
    answers: {
        type: Map,
        of: String,
    },
    newsInsights: {
        type: {
            keyThemes: [String],
            impactAssessment: {
                level: String,
                description: String,
            },
            contextConnections: [String],
            stakeholderAnalysis: {
                winners: [String],
                losers: [String],
                affected: [String],
            },
            timelineContext: [String],
        },
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: TIME_CONSTANTS.MONTH_IN_MS,    // 30 days - MongoDB TTL
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            (ret as any)._id = undefined;
            (ret as any).__v = undefined;
            return ret;
        },
    },
});

const CachedArticleEnhancementModel: ICachedArticleEnhancementModel = model<ICachedArticleEnhancement, ICachedArticleEnhancementModel>('CachedArticleEnhancement', CachedArticleEnhancementSchema);

export default CachedArticleEnhancementModel;
