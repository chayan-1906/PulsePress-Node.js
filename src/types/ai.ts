/*export const SUMMARIZATION_STYLES: SummarizationStyle[] = ['concise', 'standard', 'detailed'];
export type SummarizationStyle = 'concise' | 'standard' | 'detailed';*/

export const SUMMARIZATION_STYLES = ['concise', 'standard', 'detailed'];
export type SummarizationStyle = typeof SUMMARIZATION_STYLES[number];

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'bn', 'te', 'ta', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur', 'ne', 'si', 'my'];
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
/*export type SupportedLanguage =
// English
    | 'en'
    // Major International
    | 'es'    // Spanish
    | 'fr'    // French
    | 'de'    // German
    | 'pt'    // Portuguese
    | 'ru'    // Russian
    | 'ja'    // Japanese
    | 'ko'    // Korean
    | 'zh'    // Chinese (Simplified)
    | 'ar'    // Arabic
    // Indian Languages
    | 'hi'    // Hindi
    | 'bn'    // Bengali
    | 'te'    // Telugu
    | 'ta'    // Tamil
    | 'mr'    // Marathi
    | 'gu'    // Gujarati
    | 'kn'    // Kannada
    | 'ml'    // Malayalam
    | 'pa'    // Punjabi
    | 'or'    // Odia
    | 'as'    // Assamese
    | 'ur'    // Urdu
    | 'ne'    // Nepali
    | 'si'    // Sinhala
    | 'my';   // Myanmar*/

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
    'te': 'తెలుగు',
    'ta': 'தமிழ்',
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

export interface CombinedArticle {
    source?: {
        name?: string | null;
    };
    title?: string | null;
    url?: string | null;
    publishedAt?: string | null;
    content?: string | null;
    contentSnippet?: string | null;
    source_type: 'rss' | 'newsapi';
    relevance_score: number;
}


/** ------------- API response types ------------- */

export interface SummarizeArticleResponse {
    summary?: string;
    powered_by?: string;
    error?: string;
}

export interface GenerateContentHashResponse {
    hash?: string;
    error?: string;
}

export interface ParseQueryWithAIResponse {
    entities?: string[];
    searchTerms?: string[];
    categories?: string[];
    recommendedSources?: string[];
    intent?: string;
    originalQuery?: string;
    powered_by?: string;
    error?: string;
}

export interface ProcessNaturalQueryResponse {
    articles?: any;
    totalResults?: number;
    searchMetadata?: {
        originalQuery: string;
        aiParsed: {
            entities: string[] | undefined;
            searchTerms: string[] | undefined;
            categories: string[] | undefined;
            intent: string | undefined;
        };
        powered_by: string | undefined;
        timestamp: string;
    };
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

export interface ParseQueryWithAIParams {
    query: string;
}

export interface ProcessNaturalQueryParams {
    email: string;
    query: string;
    pageSize?: number;
}
