import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from '@google-cloud/translate/build/src/v2';
import {isListEmpty} from "../utils/list";
import {getUserByEmail} from "./AuthService";
import {fetchRSSFeed, fetchTopHeadlines, scrapeMultipleArticles} from "./NewsService";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {GEMINI_API_KEY, GOOGLE_TRANSLATE_API_KEY, NODE_ENV, RSS_CACHE_DURATION} from "../config/config";
import {AI_QUERY_PARSING_MODELS, AI_SUMMARIZATION_MODELS, RSS_SOURCES} from "../utils/constants";
import {generateInvalidCode, generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";
import {
    CombinedArticle,
    GenerateContentHashParams,
    GenerateContentHashResponse,
    GetCachedSummaryParams,
    ParseQueryWithAIParams,
    ParseQueryWithAIResponse,
    ProcessNaturalQueryParams,
    ProcessNaturalQueryResponse,
    SaveSummaryToCacheParams,
    SUMMARIZATION_STYLES,
    SummarizeArticleParams,
    SummarizeArticleResponse,
    TranslateTextParams
} from "../types/ai";
import {Article, RSSFeed} from "../types/news";

// Initialize with API key
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
export const AI_MODEL = 'gemini-1.5-flash';
const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

const SMART_SEARCH_CACHE = new Map<string, { data: any, timestamp: number }>();

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
                break; // Success - exit loop
            } catch (error) {
                if (modelName === AI_SUMMARIZATION_MODELS[AI_SUMMARIZATION_MODELS.length - 1]) {
                    throw error; // Last attempt failed
                }
                // continue; // Try next model
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

const parseQueryWithAI = async ({query}: ParseQueryWithAIParams): Promise<ParseQueryWithAIResponse> => {
    console.info('parseQueryWithAI called'.bgMagenta.white.italic, query);
    try {
        let usedModel, newsSearchResponse;
        const availableSources = Object.values(RSS_SOURCES).flatMap((langSources: object) => Object.keys(langSources));

        for (const modelName of AI_QUERY_PARSING_MODELS) {
            try {
                const model = genAI.getGenerativeModel({model: modelName});
                const prompt = `Analyze this news search query and recommend the best sources.
                        Query: "${query}"
                        Available sources: "${availableSources.join(', ')}"

                        Return JSON only:
                        {
                            "entities": ["entity1", "entity2"],
                            "searchTerms": ["term1", "term2"],
                            "categories": ["category"],
                            "recommendedSources": ["source1", "source2", "source3"],
                            "intent": "brief description"
                        }

                        Recommend 5-10 most relevant sources for this query.
                        Focus on: people, companies, countries, technologies, sports, events.
                    `;
                newsSearchResponse = await model.generateContent(prompt);
                usedModel = modelName;
                break; // Success - exit loop
            } catch (error) {
                if (modelName === AI_QUERY_PARSING_MODELS[AI_QUERY_PARSING_MODELS.length - 1]) {
                    throw error; // Last attempt failed
                }
                // continue; // Try next model
            }
        }

        const response = newsSearchResponse?.response.text();
        const jsonMatch = response?.match(/\{[\s\S]*}/);
        if (!jsonMatch) {
            throw new Error('SMART_SEARCH_FAILED');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            entities: parsed.entities || [],
            searchTerms: parsed.searchTerms || [query],
            categories: parsed.categories || [],
            recommendedSources: parsed.recommendedSources || [],
            intent: parsed.intent || '',
            originalQuery: query,
            powered_by: usedModel,
        };

    } catch (error: any) {
        console.error('AI parsing failed, using fallback:'.yellow.italic, error.message);

        // Fallback: use query words as search terms
        const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        return {
            entities: words,
            searchTerms: words,
            categories: [],
            intent: 'general search',
            originalQuery: query,
        };
    }
}

const processNaturalQuery = async ({email, query, pageSize = 20}: ProcessNaturalQueryParams): Promise<ProcessNaturalQueryResponse> => {
    console.info('processNaturalQuery called:'.bgMagenta.white.italic, query);
    try {
        if (!query?.trim()) {
            return {error: generateMissingCode('query')};
        }

        const {user, error} = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        // Generate cache key
        const data = `${query}::${pageSize.toString()}`;
        const queryHash = createHash('sha256').update(data).digest('hex');
        const cacheKey = `smart-search-${queryHash}`;

        // Check cache
        const cached = SMART_SEARCH_CACHE.get(cacheKey);
        if (NODE_ENV === 'production' && cached && Date.now() - cached.timestamp < Number(RSS_CACHE_DURATION)) {
            console.log('Smart search cache hit:'.cyan.italic, cacheKey);
            return cached.data;
        }

        // Parse query with AI
        const {entities, searchTerms, categories, recommendedSources, intent, originalQuery, powered_by} = await parseQueryWithAI({query});
        console.log('AI parsed query:'.cyan.italic, {entities, searchTerms, categories, intent, originalQuery, powered_by});

        // Prepare searches
        const searchPromises = [];

        // RSS search with category sources
        searchPromises.push(
            fetchRSSFeed({
                sources: recommendedSources?.slice(0, 8).join(','),
                pageSize: Math.ceil(pageSize * 0.6),
            }).catch(() => []),
        );

        // NewsAPI search with search terms
        searchPromises.push(
            fetchTopHeadlines({
                q: searchTerms?.slice(0, 3).join(' '),
                pageSize: Math.ceil(pageSize * 0.5),
            }).catch(() => ({articles: []})),
        );

        // Execute searches
        const results = await Promise.allSettled(searchPromises);
        const rssResults = results[0].status === 'fulfilled' ? results[0].value : [];
        const newsApiResults = results[1].status === 'fulfilled' ? results[1].value : {articles: []};

        // Combine and rank
        const combinedResults = combineAndRank(
            rssResults,
            newsApiResults || {articles: []},
            entities || [],
            searchTerms || [],
        );

        const result = {
            articles: combinedResults.slice(0, pageSize),
            totalResults: combinedResults.length,
            searchMetadata: {
                originalQuery: query,
                aiParsed: {entities, searchTerms, categories, intent},
                powered_by,
                timestamp: new Date().toISOString(),
                recommendedSources,
            },
        };

        // Cache result
        if (NODE_ENV === 'production') {
            SMART_SEARCH_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        }

        console.log('Smart search completed:'.green.italic, {query, resultsCount: result.articles.length, aiParsed: true});

        return result;
    } catch (error: any) {
        console.error('ERROR: inside catch of processNaturalQuery:'.red.bold, error);
        throw error;
    }
}

// Helper functions
const calculateRelevanceScore = (text: string, entities: string[], searchTerms: string[]): number => {
    if (!text) return 0;

    const normalizedText = text.toLowerCase();
    let score = 0;

    [...entities, ...searchTerms].forEach(term => {
        const termLower = term.toLowerCase();
        if (normalizedText.includes(termLower)) {
            score += 1;
            // Bonus for exact word matches
            if (new RegExp(`\\b${termLower}\\b`).test(normalizedText)) {
                score += 0.5;
            }
        }
    });

    return score;
}

const getRecencyBoost = (publishedAt: string): number => {
    if (!publishedAt) return 0;

    const articleDate = new Date(publishedAt);
    const hoursOld = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);

    return Math.max(0, (24 - hoursOld) / 24);
}

const combineAndRank = (rssResults: RSSFeed[], newsApiResults: any, entities: string[], searchTerms: string[]) => {
    const combined: CombinedArticle[] = [];
    const seenUrls = new Set<string>();

    // Add RSS results
    if (rssResults && Array.isArray(rssResults)) {
        rssResults.forEach((item: RSSFeed) => {
            if (item.url && !seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                combined.push({
                    ...item,
                    source_type: 'rss',
                    relevance_score: calculateRelevanceScore(item.title + ' ' + item.contentSnippet, entities, searchTerms)
                });
            }
        });
    }

    // Add NewsAPI results (check for duplicates)
    if (newsApiResults && newsApiResults.articles) {
        newsApiResults.articles.forEach((article: Article) => {
            if (article.url && !seenUrls.has(article.url)) {
                seenUrls.add(article.url);
                combined.push({
                    source: {
                        name: article.source?.name,
                    },
                    title: article.title,
                    url: article.url,
                    publishedAt: article.publishedAt,
                    content: article.content,
                    contentSnippet: article.description,
                    source_type: 'newsapi',
                    relevance_score: calculateRelevanceScore(article.title + ' ' + article.description, entities, searchTerms),
                });
            }
        });
    }

    return combined.sort((a, b) => {
        const scoreA = a.relevance_score + getRecencyBoost(a.publishedAt || '');
        const scoreB = b.relevance_score + getRecencyBoost(b.publishedAt || '');
        return scoreB - scoreA;
    }).slice(0, 100);
}

export {summarizeArticle, processNaturalQuery};
