import {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {IArticle, TArticleComplexities, TEnhancementStatus, TProcessingStatus} from "./news";

/*export const SUMMARIZATION_STYLES: SummarizationStyle[] = ['concise', 'standard', 'detailed'];
export type SummarizationStyle = 'concise' | 'standard' | 'detailed';*/

export const SUMMARIZATION_STYLES = ['concise', 'standard', 'detailed'];
export type TSummarizationStyle = typeof SUMMARIZATION_STYLES[number];

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'bn', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur', 'ne', 'si', 'my'];
export type TSupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const USER_STRIKE_BLOCK = ['cooldown', 'long_block'] as const;
export type TUserStrikeBlock = typeof USER_STRIKE_BLOCK[number];

export const CLASSIFICATION_TYPES = ['news', 'non_news', 'error'] as const;
export type TClassificationResult = typeof CLASSIFICATION_TYPES[number];

export const SENTIMENT_TYPES = ['positive', 'negative', 'neutral'] as const;
export type TSentimentResult = typeof SENTIMENT_TYPES[number];

export const COMPLEXITY_LEVELS = ['easy', 'medium', 'hard'] as const;
export type TComplexityLevel = typeof COMPLEXITY_LEVELS[number];

export const SOCIAL_MEDIA_PLATFORMS = ['twitter', 'instagram', 'linkedin', 'facebook'] as const;
export type TSocialMediaPlatform = typeof SOCIAL_MEDIA_PLATFORMS[number];

export const SOCIAL_MEDIA_CAPTION_STYLES = ['professional', 'casual', 'engaging', 'viral'] as const;
export type TSocialMediaCaptionStyle = typeof SOCIAL_MEDIA_CAPTION_STYLES[number];

export const VIOLATION_TYPES = ['search_query', 'article_summary', 'ai_enhancement'] as const;
export type TViolationType = typeof VIOLATION_TYPES[number];

export const IMPACT_LEVELS = ['local', 'regional', 'national', 'global'] as const;
export type TImpactLevel = typeof IMPACT_LEVELS[number];

export const AI_ARTICLE_ENHANCEMENT_TYPES = ['summarize', 'tags', 'sentiment', 'keyPoints', 'complexityMeter', 'questions', 'answer', 'locations', 'caption', 'newsInsights'] as const;
export type TAIArticleEnhancement = typeof AI_ARTICLE_ENHANCEMENT_TYPES[number];
export type TBasicEnhancementTypes = 'tags' | 'sentiment' | 'keyPoints' | 'complexityMeter' | 'locations';

export const LANGUAGE_NAMES: Record<TSupportedLanguage, string> = {
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'pt': 'Português',
    'ru': 'Русский',
    'ja': '日本語',
    'ko': '한국어',
    'zh': '中文',
    'ar': 'العربية',
    'hi': 'हिंदी',
    'bn': 'বাংলা',
    'te': 'తెলుగు',
    'ta': 'தமিழ்',
    'mr': 'मराठी',
    'gu': 'ગુજરાતી',
    'kn': 'ಕನ್ನಡ',
    'ml': 'മലയാളം',
    'pa': 'ਪੰਜਾਬੀ',
    'or': 'ଓଡ଼ିଆ',
    'as': 'অসমীয়া',
    'ur': 'اردو',
    'ne': 'नेपाली',
    'si': 'සිංහල',
    'my': 'မြန်မာ'
};

export interface IStrikeHistoryEvent {
    strikeNumber: number;
    appliedAt: Date;
    reason: string;
    blockType?: TUserStrikeBlock;
    blockDuration?: string;
}

export interface IStrikeResult {
    newStrikeCount: number;
    isBlocked: boolean;
    blockType?: TUserStrikeBlock;
    blockedUntil?: Date;
    message: string;
    wasReset?: boolean;
}

export interface IStrikeCheckResult {
    isBlocked: boolean;
    blockType?: TUserStrikeBlock;
    blockedUntil?: Date;
    message?: string;
    wasReset?: boolean;
}

export interface IUserStrikeStatus {
    currentStrikes: number;
    maxStrikes: number;
    isBlocked: boolean;
    blockType?: TUserStrikeBlock;
    blockedUntil?: Date;
    lastStrikeAt?: Date;
    timeUntilReset?: string;
    blockTimeRemaining?: string;
    nextStrikePenalty: string;
}

export interface IUserStrikeHistory {
    date: Date;
    strikeNumber: number;
    reason: string;
    blockType?: TUserStrikeBlock;
    blockDuration?: string;
}


/** ------------- AI Service JSON Parse Interfaces ------------- */

export interface IAIClassification {
    classification: TClassificationResult;
}

export interface IAISentiment {
    sentiment: TSentimentResult;
    confidence?: number;
}

export interface IAIKeyPoints {
    keyPoints: string[];
}

export interface IAIComplexityMeter {
    complexityMeter: {
        level: TComplexityLevel;
        reasoning?: string;
    };
}

export interface IAIQuestionGeneration {
    questions: string[];
}

export interface IAIQuestionAnswering {
    answer: string;
}

export interface IAIGeographicExtraction {
    locations: string[];
}

export interface IAISocialMediaCaption {
    caption: string;
    hashtags: string[];
    platform: TSocialMediaPlatform;
    style: TSocialMediaCaptionStyle;
}

export interface IAINewsInsights {
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
}


/** ------------- API response types ------------- */

export interface INewsClassificationResponse {
    classification?: TClassificationResult;
    isNews?: boolean;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface ISummarizeArticleResponse {
    summary?: string;
    wasClassified?: 'news' | 'non_news' | 'classification_skipped';
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface ISummarizeContentResponse {
    summary?: string;
    powered_by?: string;
    error?: string;
}

export interface ITagGenerationResponse {
    tags?: string[];
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface ISentimentAnalysisResponse {
    sentiment?: TSentimentResult;
    confidence?: number;
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IKeyPointsExtractionResponse {
    keyPoints?: string[];
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IComplexityMeterResponse {
    complexityMeter?: {
        level: TComplexityLevel;
        reasoning: string;
    };
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IReadingTimeComplexityResponse {
    level: TArticleComplexities;
    readingTimeMinutes: number;
    wordCount: number;
}

export interface IQuestionGenerationResponse {
    questions?: string[];
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IQuestionAnsweringResponse {
    answer?: string;
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IGeographicExtractionResponse {
    locations?: string[];
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface ISocialMediaCaptionResponse {
    caption?: string;
    hashtags?: string[];
    platform?: TSocialMediaPlatform;
    style?: TSocialMediaCaptionStyle;
    characterCount?: number;
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface INewsInsightsResponse {
    keyThemes?: string[];
    impactAssessment?: {
        level: TImpactLevel;
        description: string;
    };
    contextConnections?: string[];
    stakeholderAnalysis?: {
        winners?: string[];
        losers?: string[];
        affected?: string[];
    };
    timelineContext?: string[];
    powered_by?: string;
    error?: string;
    message?: string;
    strikeCount?: number;
    isBlocked?: boolean;
    blockedUntil?: Date;
    blockType?: TUserStrikeBlock;
}

export interface IGetProcessingStatusResponse {
    status: TEnhancementStatus;
    progress: number;
}

export interface IGetEnhancementStatusByIdsResponse {
    status?: TEnhancementStatus;
    progress?: number;
    articles?: Partial<IArticle>[];
    error?: string;
}

export interface ICombinedAIResponse {
    tags?: string[],
    sentiment?: {
        type: TSentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: TComplexityLevel;
        reasoning: string;
    };
    locations?: string[];
    questions?: string[];
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
    powered_by?: string;
    error?: string;
}

export interface IFetchArticleDetailsEnhancementResponse {
    enhanced: boolean;
    progress: number;
    article?: Partial<IArticleEnhancement> | null;
    error?: string;
}

export interface IGetCachedSummaryVariationResponse {
    content: string;
    style: TSummarizationStyle;
    language: TSupportedLanguage;
    createdAt: Date;
}

export interface IGetCachedCaptionVariationResponse {
    content: string;
    style: TSocialMediaCaptionStyle;
    platform?: TSocialMediaPlatform;
    createdAt: Date;
}

export interface IGetCachedQuestionsResponse {
    questions: string[];
    createdAt: Date;
}

export interface IGetCachedQuestionAnswerResponse {
    question: string;
    answer: string;
    createdAt: Date;
}

// TODO: Use in getCachedNewsInsights()
export interface IGetCachedNewsInsightsResponse {
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
    createdAt: Date;
}

export interface IGetUserStrikeStatusResponse {
    strikeStatus?: IUserStrikeStatus;
    error?: string;
}

export interface IGetUserStrikeHistoryResponse {
    strikeHistory?: IUserStrikeHistory[];
    totalStrikes?: number;
    error?: string;
}


/** ------------- function params ------------- */

export interface INewsClassificationParams {
    email: string;  // for authMiddleware
    text?: string;
    url: string;
}

export interface ISummarizeArticleParams {
    email: string;  // for authMiddleware
    content?: string;
    url: string;
    language?: TSupportedLanguage;
    style?: TSummarizationStyle;
}

export interface ISummarizeContentWithModelParams {
    content?: string;
    url: string;
    style?: TSummarizationStyle;
    modelName: string;
}

export interface ITagGenerationParams {
    email: string;  // for authMiddleware
    content?: string;
    url: string;
}

export interface ISentimentAnalysisParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
}

export interface IKeyPointsExtractionParams {
    email: string;
    url: string;
    content?: string;
}

export interface IComplexityMeterParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
}

export interface IReadingTimeComplexityParams {
    article: IArticle;
}

export interface IQuestionGenerationParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
}

export interface IQuestionAnsweringParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
    question: string;
}

export interface IGeographicExtractionParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
}

export interface ISocialMediaCaptionParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
    platform?: TSocialMediaPlatform;
    style?: TSocialMediaCaptionStyle;
}

export interface INewsInsightsParams {
    email: string;  // for authMiddleware
    url: string;
    content?: string;
}

export interface IEnhanceArticlesParams {
    email: string;  // for authMiddleware
    articles: IArticle[];
}

export interface IGetEnhancementForArticlesParams {
    articles: IArticle[];
}

export interface IGetProcessingStatusParams {
    articles: IArticle[];
}

export interface IGetEnhancementStatusByIdsParams {
    email: string;  // for authMiddleware
    articleIds: string[];
}

export interface IMergeEnhancementsWithArticlesParams {
    articles: IArticle[];
    enhancements: {
        [articleId: string]: IArticleEnhancement;
    };
}

export interface ICombinedAIParams {
    content: string;
    tasks: TAIArticleEnhancement[];
    selectedModel?: string;
}

export interface IFetchArticleDetailsEnhancementParams {
    email?: string;  // for authMiddleware
    url: string;
}

export interface IUpdateArticlesProcessingStatusParams {
    articles: IArticle[];
    status: 'cancelled' | 'failed';
}

export interface IUpdateArticleIdsProcessingStatusParams {
    articleIds: string[];
    // status: 'pending' | 'completed' | 'cancelled' | 'failed';
    status: TProcessingStatus;
}

export interface IBasicEnhancementsParams {
    articleId: string;
    url: string;
    tags?: string[];
    sentiment?: {
        type: TSentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: TComplexityLevel;
        reasoning: string;
    };
    locations?: string[];
}

export interface ISaveSummaryVariationParams {
    articleId: string;
    summary: string;
    url: string;
    style: TSummarizationStyle;
    language: TSupportedLanguage;
}

export interface IGetCachedSummaryVariationParams {
    articleId: string;
    style: TSummarizationStyle;
    language: TSupportedLanguage;
}

export interface ISaveCaptionVariationParams {
    articleId: string;
    caption: string;
    url: string;
    style: TSocialMediaCaptionStyle;
    platform?: TSocialMediaPlatform;
}

export interface IGetCachedCaptionVariationParams {
    articleId: string;
    style: TSocialMediaCaptionStyle;
    platform?: TSocialMediaPlatform;
}

export interface ISaveQuestionsParams {
    articleId: string;
    url: string;
    questions: string[];
}

export interface IGetCachedQuestionsParams {
    articleId: string;
}

export interface ISaveQuestionAnswerParams {
    articleId: string;
    url: string;
    question: string;
    answer: string;
}

export interface IGetCachedQuestionAnswerParams {
    articleId: string;
    question: string;
}

export interface ISaveNewsInsightsParams {
    articleId: string;
    url: string;
    newsInsights: IAINewsInsights;
}

export interface IGetCachedNewsInsightsParams {
    articleId: string;
}

export interface IGetUserStrikeStatusParams {
    email: string;  // for authMiddleware
}

export interface IGetUserStrikeHistoryParams {
    email: string;  // for authMiddleware
    limit?: number;
}

export interface ICheckUserBlockParams {
    email: string;  // for authMiddleware
}

export interface ILogNonNewsViolationParams {
    email: string;  // for authMiddleware
    violationType: string;
    content: string;
}

export interface IApplyStrikeParams {
    email: string;  // for authMiddleware
    violationType?: TViolationType;
    content?: string;
}

export interface IGetUserStrikesParams {
    email: string;  // for authMiddleware
}
