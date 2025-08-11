import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from '@google-cloud/translate/build/src/v2';
import {isListEmpty} from "../utils/list";
import StrikeService from "./StrikeService";
import {getUserByEmail} from "./AuthService";
import {scrapeMultipleArticles} from "./NewsService";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {AI_QUERY_PARSING_MODELS, AI_SUMMARIZATION_MODELS} from "../utils/constants";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {GEMINI_API_KEY, GEMINI_QUOTA_MS, GEMINI_QUOTA_REQUESTS, GOOGLE_TRANSLATE_API_KEY, NODE_ENV} from "../config/config";
import {
    GenerateContentHashParams,
    GenerateContentHashResponse,
    GetCachedSummaryParams,
    SaveSummaryToCacheParams,
    SUMMARIZATION_STYLES,
    SummarizeArticleParams,
    SummarizeArticleResponse,
    TranslateTextParams
} from "../types/ai";

// Initialize with API key
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
export const AI_MODEL = 'gemini-1.5-flash';
const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

let geminiRequestCount = 0;

setInterval(() => {
    geminiRequestCount = 0;
    console.log('Daily Gemini API counter reset'.cyan.italic);
}, Number.parseInt(GEMINI_QUOTA_MS!));

const summarizeArticle = async ({email, content, urls, language = 'en', style = 'standard'}: SummarizeArticleParams): Promise<SummarizeArticleResponse> => {
    console.info('summarizeArticle called'.bgMagenta.white.italic, {content, urls});
    try {
        if (!content && isListEmpty(urls)) {
            console.error('content and urls both invalid:'.yellow.italic, {content, urls});
            return {error: 'CONTENT_OR_URL_REQUIRED'};
        }
        if (content && !isListEmpty(urls)) {
            console.error('content and urls both valid:'.yellow.italic, {content, urls});
            return {error: 'CONTENT_AND_URL_CONFLICT'};
        }
        if (style && !SUMMARIZATION_STYLES.includes(style)) {
            console.error('Invalid style:'.yellow.italic, style);
            return {error: generateInvalidCode('style')};
        }

        const {isBlocked, message, blockedUntil, blockType} = await StrikeService.checkUserBlock(email);
        if (isBlocked) {
            console.log('User blocked from AI summarization:'.yellow.italic, {message, blockedUntil, blockType});
            return {
                error: 'USER_BLOCKED_FROM_AI_FEATURES',
                errorMsg: message || 'You are temporarily blocked from using AI features due to non-news queries',
            };
        }

        if (geminiRequestCount >= Number.parseInt(GEMINI_QUOTA_REQUESTS!)) {
            console.log('Gemini API daily limit reached'.yellow.italic);
            return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
        }

        let articleContent = content || '';
        if (!content && !isListEmpty(urls)) {
            console.info('inside !content && !isListEmpty(urls)'.bgMagenta.white.italic);
            const scrapedArticles = await scrapeMultipleArticles({urls});
            if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
                console.error('Scraping failed:'.red.bold, {count: scrapedArticles.length}, {error: scrapedArticles[0].error})
                return {error: 'SCRAPING_FAILED'};
            }

            console.log('content:', scrapedArticles);
            articleContent = scrapedArticles[0]?.content || '';
        }

        if (!articleContent) {
            return {error: generateMissingCode('content')};
        }
        console.info('articleContent'.bgMagenta.white.italic, articleContent);

        const {user} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        // Generate hash and check cache
        const {hash} = await generateContentHash({articleContent, language, style});
        if (!hash) {
            return {error: 'HASH_FAILED'};
        }
        const cached = await getCachedSummary({contentHash: hash});

        if (NODE_ENV === 'production' && cached) {
            return {
                summary: cached.summary,
                powered_by: 'Cached Result',
            };
        }

        let usedModel, summarizedArticleResponse;

        let prompt = '';
        if (style === 'concise') {
            prompt = `Summarize the following news article in 20% of its original length. Focus only on the key facts and avoid unnecessary details.\n Content: ${articleContent}`;
        } else if (style === 'standard') {
            prompt = `Provide a balanced summary of the following news article in 40% of its original length. Include the main points while keeping the core context intact.\n Content: ${articleContent}`;
        } else if (style === 'detailed') {
            prompt = `Summarize the following news article in 60% of its original length. Include more context and background to preserve the depth of the article.\n Content: ${articleContent}`;
        }

        for (const modelName of AI_SUMMARIZATION_MODELS) {
            try {
                const model = genAI.getGenerativeModel({model: modelName});
                summarizedArticleResponse = await model.generateContent(prompt);
                usedModel = modelName;
                geminiRequestCount++;
                console.log(`Gemini API request ${geminiRequestCount}/1500:`.cyan.italic, 'summarization');
                break; // Success - exit loop
            } catch (error) {
                if (modelName === AI_SUMMARIZATION_MODELS[AI_SUMMARIZATION_MODELS.length - 1]) {
                    throw error; // Last attempt failed
                }
            }
        }

        const text = summarizedArticleResponse?.response.text();
        if (!text || text.trim() === '') {
            return {error: 'SUMMARIZATION_FAILED'};
        }

        let finalSummary = text;
        if (language !== 'en') {
            finalSummary = await translateText({text, targetLanguage: language});
        }

        // After AI generates summary, save to cache:
        if (NODE_ENV === 'production') {
            await saveSummaryToCache({contentHash: hash, summary: finalSummary, language, style});
        }

        return {
            summary: finalSummary,
            powered_by: usedModel + (language !== 'en' ? ' + Translate' : ''),
        };
    } catch (error: any) {
        console.error('ERROR: inside catch of summarizeArticle:'.red.bold, error);
        throw error;
    }
}

const generateContentHash = async ({articleContent, language = 'en', style = 'standard'}: GenerateContentHashParams): Promise<GenerateContentHashResponse> => {
    try {
        if (!articleContent) {
            return {error: generateMissingCode('content')};
        }

        const data = `${articleContent}::${language}::${style}`;
        const contentHash = createHash('sha256').update(data).digest('hex');
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

const expandQueryWithAI = async ({email, query}: { email: string | undefined; query: string }): Promise<string[]> => {
    try {
        const {user} = await getUserByEmail({email});
        if (user) {
            if (geminiRequestCount >= Number.parseInt(GEMINI_QUOTA_REQUESTS!)) {
                console.log('Gemini API daily limit reached, skipping AI expansion'.yellow.italic);
                return [query];
            }

            console.log('user found:'.cyan.italic, user);
            const model = genAI.getGenerativeModel({model: AI_QUERY_PARSING_MODELS[0]});

            const prompt = `You are a news search query expansion expert. Expand this search query with 1-2 highly relevant terms for better news search results.

                            Query: "${query}"
                            
                            EXPANSION RULES:
                            1. ALWAYS include the original query as the first element
                            2. Add 1-2 terms that are DIRECTLY related and newsworthy
                            3. Focus on terms that news outlets would actually use in headlines/articles
                            4. Avoid generic words like "news", "update", "report", "story"
                            5. For current events, add specific location, date, or key figure names
                            6. For business topics, add company-specific or industry-specific terms
                            7. For political topics, add specific politicians, countries, or policy areas
                            8. For technology topics, add specific product names or technical terms
                            9. Terms should help find MORE relevant articles, not fewer
                            
                            DOMAIN-SPECIFIC GUIDELINES:
                            - Aviation: Use "aviation", "airline industry", "air travel", "aircraft", "airport"
                            - Politics: Use specific country names, politician names, "diplomatic", "policy"
                            - Business: Use "corporate", "financial", "market", "industry", specific company names
                            - Technology: Use specific product names, "tech industry", "innovation", "digital"
                            - Sports: Use specific sport names, team names, "championship", "tournament"
                            - Health: Use "medical", "healthcare", "pharmaceutical", "clinical"
                            
                            OUTPUT FORMAT:
                            Return ONLY a valid JSON array with the original query first, then 1-2 expansion terms.
                            
                            EXAMPLES:
                            Query: "Tesla earnings" → ["Tesla earnings", "electric vehicle sales", "Elon Musk"]
                            Query: "US Labor Day sales" → ["US Labor Day sales", "retail holiday shopping", "September retail"]  
                            Query: "Airline fuel setback" → ["Airline fuel setback", "aviation fuel costs", "jet fuel prices"]
                            Query: "Trump Putin meeting" → ["Trump Putin meeting", "US Russia summit", "diplomatic talks"]
                            Query: "climate change" → ["climate change", "global warming", "environmental policy"]
                            Query: "iPhone 15" → ["iPhone 15", "Apple smartphone", "mobile technology"]
                        `;

            const result = await model.generateContent(prompt);
            geminiRequestCount++;
            console.log(`Gemini API request ${geminiRequestCount}/${GEMINI_QUOTA_REQUESTS}:`.cyan.italic, 'query expansion');

            const responseText = result.response.text().trim();

            const jsonMatch = responseText.match(/\[[\s\S]*?]/);
            if (jsonMatch) {
                try {
                    const expandedTerms = JSON.parse(jsonMatch[0]);

                    if (Array.isArray(expandedTerms) && expandedTerms.length > 0) {
                        const validTerms = expandedTerms
                            .filter(term => typeof term === 'string' && term.trim().length > 0)
                            .slice(0, 3);

                        if (validTerms.length > 0 && !validTerms[0].includes(query.trim())) {
                            validTerms[0] = query.trim();
                        }

                        console.log(`Query expanded: "${query}" → [${validTerms.join(', ')}]`.green);
                        return validTerms.length > 0 ? validTerms : [query];
                    }
                } catch (parseError) {
                    console.error('Failed to parse AI expansion response:', parseError);
                }
            }

            console.log('AI expansion failed to return valid JSON, using original query'.yellow.italic);
            return [query];
        } else {
            console.log('Anonymous users can\'t use AI features:'.yellow.italic, user);
            return [query];
        }
    } catch (error) {
        console.error('Query expansion failed:', error);
        return [query];
    }
}

export {summarizeArticle, expandQueryWithAI};
