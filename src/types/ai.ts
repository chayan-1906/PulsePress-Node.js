import {IArticleEnhancement} from "../models/ArticleEnhancementSchema";
import {IArticle, TArticleComplexities, TEnhancementStatus} from "./news";

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

export const IMPACT_LEVELS = ['local', 'regional', 'national', 'global'] as const;
export type TImpactLevel = typeof IMPACT_LEVELS[number];

export const STAKEHOLDER_TYPES = ['consumers', 'businesses', 'government', 'investors', 'workers', 'environment', 'technology'] as const;
export type TStakeholderType = typeof STAKEHOLDER_TYPES[number];

export const AI_ARTICLE_ENHANCEMENT_TYPES = ['tags', 'sentiment', 'keyPoints', 'complexityMeter', 'geoExtraction', 'questions', 'newsInsights'];
export type TAIArticleEnhancement = typeof AI_ARTICLE_ENHANCEMENT_TYPES[number];

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

export interface IEnrichedArticleWithSentiment {
    source: {
        id: string | null;
        name: string | null;
    };
    author: string | null;
    title: string | null;
    description: string | null;
    url: string | null;
    urlToImage: string | null;
    publishedAt: string | null;
    content: string | null;
    qualityScore?: {
        score: number;
        reasons: string[];
        isRelevant: boolean;
        isProfessional: boolean;
    };
    sentimentData?: {
        sentiment: TSentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
}

export interface IStrikeHistoryEvent {
    strikeNumber: number;
    appliedAt: Date;
    reason: string;
    blockType?: TUserStrikeBlock;
    blockDuration?: string;
}

export interface IStrikeResult {
    success: boolean;
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

export interface IAISentiment {
    sentiment: TSentimentResult;
    confidence?: number;
}

export interface IAIClassification {
    classification: TClassificationResult;
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

export interface ISummarizeArticleResponse {
    summary?: string;
    wasClassified?: 'news' | 'non_news' | 'classification_skipped';
    powered_by?: string;
    error?: string;
    errorMsg?: string;
}

export interface ISummarizeContentResponse {
    summary?: string;
    powered_by?: string;
    error?: string;
}

export interface IGenerateContentHashResponse {
    hash?: string;
    error?: string;
}

export interface ITagGenerationResponse {
    tags?: string[];
    powered_by?: string;
    error?: string;
}

export interface ISentimentAnalysisResponse {
    sentiment?: TSentimentResult;
    confidence?: number;
    powered_by?: string;
    error?: string;
}

export interface IKeyPointsExtractionResponse {
    keyPoints?: string[];
    powered_by?: string;
    error?: string;
}

export interface IComplexityMeterResponse {
    complexityMeter?: {
        level: TComplexityLevel;
        reasoning: string;
    };
    powered_by?: string;
    error?: string;
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
}

export interface IQuestionAnsweringResponse {
    answer?: string;
    powered_by?: string;
    error?: string;
}

export interface IGeographicExtractionResponse {
    locations?: string[];
    powered_by?: string;
    error?: string;
}

export interface ISocialMediaCaptionResponse {
    caption?: string;
    hashtags?: string[];
    platform?: TSocialMediaPlatform;
    style?: TSocialMediaCaptionStyle;
    characterCount?: number;
    powered_by?: string;
    error?: string;
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

export interface ISummarizeArticleParams {
    email: string;  // for authMiddleware
    content?: string;
    url?: string;
    language?: TSupportedLanguage;
    style?: TSummarizationStyle;
}

export interface ISummarizeContentParams {
    content?: string;
    url?: string;
    style?: TSummarizationStyle;
}

export interface ISummarizeContentWithModelParams {
    content?: string;
    url?: string;
    style?: TSummarizationStyle;
    modelName: string;
}

export interface IGenerateContentHashParams {
    articleContent: string;
    language?: TSupportedLanguage;
    style?: TSummarizationStyle;
}

export interface ISaveSummaryToCacheParams {
    contentHash: string;
    summary: string;
    language?: TSupportedLanguage;
    style?: TSummarizationStyle;
}

export interface IGetCachedSummaryParams {
    contentHash: string;
}

export interface ITranslateTextParams {
    text: string;
    targetLanguage: TSupportedLanguage;
}

export interface ITagGenerationParams {
    content?: string;
    url?: string;
}

export interface ISentimentAnalysisParams {
    url?: string;
    content?: string;
}

export interface IEnrichArticleWithSentimentParams {
    article: any;
    shouldAnalyze?: boolean;
}

export interface IEnrichArticlesWithSentimentParams {
    articles: any[];
    shouldAnalyze?: boolean;
}

export interface IKeyPointsExtractionParams {
    url?: string;
    content?: string;
}

export interface IComplexityMeterParams {
    url?: string;
    content?: string;
}

export interface IReadingTimeComplexityParams {
    article: IArticle;
}

export interface IQuestionGenerationParams {
    content: string;
}

export interface IQuestionAnsweringParams {
    content: string;
    question: string;
}

export interface IGeographicExtractionParams {
    url?: string;
    content?: string;
}

export interface ISocialMediaCaptionParams {
    url?: string;
    content?: string;
    platform?: TSocialMediaPlatform;
    style?: TSocialMediaCaptionStyle;
}

export interface INewsInsightsParams {
    url?: string;
    content?: string;
}

export interface ICombinedAIParams {
    content: string;
    tasks: TAIArticleEnhancement[];
    selectedModel?: string;
}

export interface ICombinedAIDetailsParams {
    email?: string;
    url: string;
}

export interface IGetProcessingStatusParams {
    articles: IArticle[];
}

export interface IEnhanceArticlesParams {
    email: string;  // for authMiddleware
    articles: IArticle[];
}

export interface IGetEnhancementForArticlesParams {
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

export interface IGetUserStrikeStatusParams {
    email: string;  // for authMiddleware
}

export interface IGetUserStrikeHistoryParams {
    email: string;  // for authMiddleware
    limit?: number;
}
