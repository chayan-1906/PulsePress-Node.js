import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {IUser} from "../models/UserSchema";
import {getUserByEmail} from "./AuthService";
import {Translate} from '@google-cloud/translate/build/src/v2';
import {GEMINI_API_KEY, GOOGLE_TRANSLATE_API_KEY} from "../config/config";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    GenerateContentHashParams,
    GenerateContentHashResponse,
    GetCachedSummaryParams,
    SaveSummaryToCacheParams,
    SummarizeArticleParams,
    SummarizeArticleResponse,
    TranslateTextParams
} from "../types/ai";

// Initialize with API key
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

const summarizeArticle = async ({email, content, language = 'en', style = 'standard'}: SummarizeArticleParams): Promise<SummarizeArticleResponse> => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const user: IUser | null = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        // Generate hash and check cache
        const {hash} = await generateContentHash({content, language, style});
        if (!hash) {
            return {error: 'HASH_FAILED'};
        }
        const cached = await getCachedSummary({contentHash: hash});

        if (cached) {
            return {
                summary: cached.summary,
                powered_by: 'Cached Result',
            };
        }

        const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

        let prompt = '';
        if (style === 'concise') {
            prompt = `Summarize the following news article in 20% of its original length. Focus only on the key facts and avoid unnecessary details.\n Content: ${content}`;
        } else if (style === 'standard') {
            prompt = `Provide a balanced summary of the following news article in 40% of its original length. Include the main points while keeping the core context intact.\n Content: ${content}`;
        } else if (style === 'detailed') {
            prompt = `Summarize the following news article in 60% of its original length. Include more context and background to preserve the depth of the article.\n Content: ${content}`;
        }

        const summarizedArticleResponse = await model.generateContent(prompt);
        const text = summarizedArticleResponse.response.text();
        if (!text || text.trim() === '') {
            return {error: 'SUMMARIZATION_FAILED'};
        }

        let finalSummary = text;
        if (language !== 'en') {
            finalSummary = await translateText({text, targetLanguage: language});
        }

        // After AI generates summary, save to cache:
        await saveSummaryToCache({contentHash: hash, summary: finalSummary, language, style});

        return {
            summary: finalSummary,
            powered_by: 'Google Gemini AI' + (language !== 'en' ? ' + Translate' : ''),
        };
    } catch (error: any) {
        console.error('ERROR: inside catch of summarizeArticle:'.red.bold, error);
        throw error;
    }
}

const generateContentHash = async ({content, language = 'en', style = 'standard'}: GenerateContentHashParams): Promise<GenerateContentHashResponse> => {
    try {
        if (!content) {
            return {error: generateMissingCode('content')};
        }

        const data = `${content}::${language}::${style}`;
        const contentHash = createHash('sha256')
            .update(data)
            .digest('hex');
        console.log('content hash generated:'.cyan.italic, contentHash);

        return {hash: contentHash};
    } catch (error: any) {
        console.error('ERROR: inside catch of generateContentHash:'.red.bold, error);
        throw error;
    }
}

const saveSummaryToCache = async ({contentHash, summary, language, style}: SaveSummaryToCacheParams): Promise<ICachedSummary | null> => {
    try {
        const savedContentHash: ICachedSummary | null = await CachedSummaryModel.create({contentHash, summary, language, style});
        console.log('saved content hash'.cyan.italic, savedContentHash);
        return savedContentHash;
    } catch (error: any) {
        console.error('ERROR: inside catch of saveSummaryToCache:'.red.bold, error);
        throw error;
    }
}

const getCachedSummary = async ({contentHash}: GetCachedSummaryParams): Promise<ICachedSummary | null> => {
    const cachedSummary: ICachedSummary | null = await CachedSummaryModel.findOne({
        contentHash,
        expiresAt: {$gt: new Date()}, // not expired
    });
    console.log('cachedSummary'.cyan.italic, cachedSummary);
    return cachedSummary;
}

const translateText = async ({text, targetLanguage}: TranslateTextParams): Promise<string> => {
    console.log('translateText:', {text, targetLanguage});
    try {
        const [translation] = await translate.translate(text, {
            to: targetLanguage, // 'bn' for Bengali, 'hi' for Hindi, etc.
        });
        console.log('translation:'.cyan.italic, translation);
        return translation;
    } catch (error: any) {
        console.error('ERROR: inside catch of translateText:'.red.bold, error);
        return text; // fallback to original text
    }
}

export {summarizeArticle};
