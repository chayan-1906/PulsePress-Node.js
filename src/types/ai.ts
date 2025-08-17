/*export const SUMMARIZATION_STYLES: SummarizationStyle[] = ['concise', 'standard', 'detailed'];
export type SummarizationStyle = 'concise' | 'standard' | 'detailed';*/

export const SUMMARIZATION_STYLES = ['concise', 'standard', 'detailed'];
export type SummarizationStyle = typeof SUMMARIZATION_STYLES[number];

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'bn', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur', 'ne', 'si', 'my'];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const USER_STRIKE_BLOCK = ['cooldown', 'long_block'] as const;
export type UserStrikeBlock = typeof USER_STRIKE_BLOCK[number];

export const CLASSIFICATION_TYPES = ['news', 'non_news', 'error'] as const;
export type ClassificationResult = typeof CLASSIFICATION_TYPES[number];

export const SENTIMENT_TYPES = ['positive', 'negative', 'neutral'] as const;
export type SentimentResult = typeof SENTIMENT_TYPES[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
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

export interface EnrichedArticleWithSentiment {
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
        sentiment: SentimentResult;
        confidence: number;
        emoji: string;
        color: string;
    };
}

export interface StrikeHistoryEvent {
    strikeNumber: number;
    appliedAt: Date;
    reason: string;
    blockType?: UserStrikeBlock;
    blockDuration?: string;
}

export interface StrikeResult {
    success: boolean;
    newStrikeCount: number;
    isBlocked: boolean;
    blockType?: UserStrikeBlock;
    blockedUntil?: Date;
    message: string;
    wasReset?: boolean;
}

export interface StrikeCheckResult {
    isBlocked: boolean;
    blockType?: UserStrikeBlock;
    blockedUntil?: Date;
    message?: string;
    wasReset?: boolean;
}

export interface UserStrikeStatus {
    currentStrikes: number;
    maxStrikes: number;
    isBlocked: boolean;
    blockType?: UserStrikeBlock;
    blockedUntil?: Date;
    lastStrikeAt?: Date;
    timeUntilReset?: string;
    blockTimeRemaining?: string;
    nextStrikePenalty: string;
}

export interface UserStrikeHistory {
    date: Date;
    strikeNumber: number;
    reason: string;
    blockType?: UserStrikeBlock;
    blockDuration?: string;
}


/** ------------- API response types ------------- */

export interface SummarizeArticleResponse {
    summary?: string;
    powered_by?: string;
    wasClassified?: 'news' | 'non_news' | 'classification_skipped';
    error?: string;
    errorMsg?: string;
}

export interface GenerateContentHashResponse {
    hash?: string;
    error?: string;
}

export interface SentimentAnalysisResponse {
    sentiment?: SentimentResult;
    confidence?: number;
    error?: string;
}

export interface GetUserStrikeStatusResponse {
    strikeStatus?: UserStrikeStatus;
    error?: string;
}

export interface GetUserStrikeHistoryResponse {
    strikeHistory?: UserStrikeHistory[];
    totalStrikes?: number;
    error?: string;
}


/** ------------- function params ------------- */

export interface SummarizeArticleParams {
    email: string;  // for authMiddleware
    content?: string;
    urls?: string[];
    language?: SupportedLanguage;
    style?: SummarizationStyle;
}

export interface GenerateContentHashParams {
    articleContent: string;
    language?: SupportedLanguage;
    style?: SummarizationStyle;
}

export interface SaveSummaryToCacheParams {
    contentHash: string;
    summary: string;
    language?: SupportedLanguage;
    style?: SummarizationStyle;
}

export interface GetCachedSummaryParams {
    contentHash: string;
}

export interface TranslateTextParams {
    text: string;
    targetLanguage: SupportedLanguage;
}

export interface SentimentAnalysisParams {
    content: string;
}

export interface GetUserStrikeStatusParams {
    email: string;
}

export interface GetUserStrikeHistoryParams {
    email: string;
    limit?: number;
}
