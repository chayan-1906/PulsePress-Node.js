import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from '@google-cloud/translate/build/src/v2';
import {isListEmpty} from "../utils/list";
import {getUserByEmail} from "./AuthService";
import {Article, RSSFeed} from "../types/news";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {fetchEverything, fetchRSSFeed, scrapeMultipleArticles} from "./NewsService";
import {AI_QUERY_PARSING_MODELS, AI_SUMMARIZATION_MODELS, RSS_SOURCES} from "../utils/constants";
import {GEMINI_API_KEY, GOOGLE_TRANSLATE_API_KEY, NODE_ENV, RSS_CACHE_DURATION} from "../config/config";
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
            fetchEverything({
                q: searchTerms?.slice(0, 3).join(' '),
                pageSize: Math.ceil(pageSize * 0.5),
                sortBy: 'publishedAt',
                language: 'en',
            }).catch(() => ({articles: []})),
        );

        // Execute searches
        const results = await Promise.allSettled(searchPromises);
        const rssResults: RSSFeed[] = [];
        // const newsApiResults = results[1].status === 'fulfilled' ? results[1].value : {articles: []};

        const newsApiResults = await fetchEverything({
            q: searchTerms?.slice(0, 3).join(' '),
            pageSize: pageSize, // Use full pageSize since no RSS
            sortBy: 'publishedAt',
            language: 'en'
        }).catch(() => ({articles: []}));

        console.log('NewsAPI results:'.yellow.italic, {
            query: searchTerms?.slice(0, 3).join(' '),
            totalResults: newsApiResults?.totalResults || 0,
            articlesCount: newsApiResults?.articles?.length || 0
        });

        // Combine and rank
        const combinedResults = combineAndRank(
            rssResults,
            newsApiResults || {articles: []},
            entities || [],
            searchTerms || [],
            categories || [],
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
const calculateRelevanceScore = (text: string, entities: string[], searchTerms: string[], aiCategories: string[] = []): number => {
    if (!text) return 0;

    const normalizedText = text.toLowerCase();
    let entityScore = 0;
    let termScore = 0;
    let contextScore = 0;
    const matches: string[] = [];

    // Check entities
    entities.forEach(entity => {
        const entityLower = entity.toLowerCase();
        if (normalizedText.includes(entityLower)) {
            entityScore += 3;
            matches.push(`"${entity}" (entity)`);

            if (new RegExp(`\\b${entityLower}\\b`).test(normalizedText)) {
                entityScore += 1.5;
                matches.push(`"${entity}" (entity word boundary)`);
            }
        }
    });

    // Check search terms (skip generic terms)
    searchTerms.forEach(term => {
        const termLower = term.toLowerCase();
        if (['today', 'news', 'latest', 'recent'].includes(termLower)) {
            return;
        }

        if (normalizedText.includes(termLower)) {
            termScore += 1;
            matches.push(`"${term}" (term)`);

            if (new RegExp(`\\b${termLower}\\b`).test(normalizedText)) {
                termScore += 0.5;
                matches.push(`"${term}" (term word boundary)`);
            }
        }
    });

    // NEW: Context-aware filtering based on AI categories
    if (aiCategories.length > 0) {
        const sportKeywords = ['cricket', 'test', 'match', 'series', 'runs', 'wickets', 'innings', 'captain', 'bowler', 'batsman', 'oval', 'stadium'];
        const financeKeywords = ['stock', 'price', 'market', 'trading', 'shares', 'investment', 'revenue', 'earnings'];
        const techKeywords = ['technology', 'software', 'ai', 'tech', 'startup', 'app', 'platform'];

        // Check if content matches the query context
        if (aiCategories.some(cat => ['Sports', 'Cricket'].includes(cat))) {
            const hasSportContext = sportKeywords.some(keyword => normalizedText.includes(keyword));
            if (hasSportContext) {
                contextScore += 2;
                matches.push('(sports context)');
            } else {
                // Heavy penalty for non-sports content in sports queries
                contextScore -= 5;
                matches.push('(wrong context: not sports)');
            }
        } else if (aiCategories.some(cat => ['Finance', 'Business', 'Economy'].includes(cat))) {
            const hasFinanceContext = financeKeywords.some(keyword => normalizedText.includes(keyword));
            if (hasFinanceContext) {
                contextScore += 2;
                matches.push('(finance context)');
            }
        } else if (aiCategories.some(cat => ['Technology'].includes(cat))) {
            const hasTechContext = techKeywords.some(keyword => normalizedText.includes(keyword));
            if (hasTechContext) {
                contextScore += 2;
                matches.push('(tech context)');
            }
        }
    }

    const totalScore = entityScore + termScore + contextScore;

    // STRICT RULES:
    // 1. Must have entity match
    // 2. Must have positive context score (or neutral for non-contextual queries)
    if (entityScore === 0 || (aiCategories.length > 0 && contextScore < 0)) {
        if (entityScore > 0 || termScore > 0) {
            console.log(`FILTERED OUT:`.red.bold);
            console.log(`  Text: "${text.substring(0, 100)}..."`.cyan);
            console.log(`  Matches: ${matches.join(', ')}`.magenta);
            console.log(`  EntityScore: ${entityScore}, TermScore: ${termScore}, ContextScore: ${contextScore}`.blue);
            console.log(`  Total Score: ${totalScore} -> 0 (filtered)`.red.bold);
            console.log('---');
        }
        return 0;
    }

    // Debug logging
    if (totalScore > 0) {
        console.log(`RELEVANCE DEBUG:`.yellow.bold);
        console.log(`  Text: "${text.substring(0, 100)}..."`.cyan);
        console.log(`  Entities: [${entities.join(', ')}]`.green);
        console.log(`  SearchTerms: [${searchTerms.join(', ')}]`.green);
        console.log(`  Categories: [${aiCategories.join(', ')}]`.green);
        console.log(`  Matches: ${matches.join(', ')}`.magenta);
        console.log(`  EntityScore: ${entityScore}, TermScore: ${termScore}, ContextScore: ${contextScore}`.blue);
        console.log(`  Total Score: ${totalScore}`.red.bold);
        console.log('---');
    }

    return totalScore;
}

const getRecencyBoost = (publishedAt: string): number => {
    if (!publishedAt) return 0;

    const articleDate = new Date(publishedAt);
    const hoursOld = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);

    return Math.max(0, (24 - hoursOld) / 24);
}

// Replace your combineAndRank function signature and calls:

// 1. Update combineAndRank function signature:
const combineAndRank = (rssResults: RSSFeed[], newsApiResults: any, entities: string[], searchTerms: string[], aiCategories: string[] = []) => {
    const combined: CombinedArticle[] = [];
    const seenUrls = new Set<string>();

    // Add RSS results
    if (rssResults && Array.isArray(rssResults)) {
        rssResults.forEach((item: RSSFeed) => {
            if (item.url && !seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                const relevanceScore = calculateRelevanceScore(item.title + ' ' + item.contentSnippet, entities, searchTerms, aiCategories);

                if (relevanceScore > 0) {
                    combined.push({
                        ...item,
                        source_type: 'rss',
                        relevance_score: relevanceScore
                    });
                }
            }
        });
    }

    // Add NewsAPI results
    if (newsApiResults && newsApiResults.articles) {
        newsApiResults.articles.forEach((article: Article) => {
            if (article.url && !seenUrls.has(article.url)) {
                seenUrls.add(article.url);
                const relevanceScore = calculateRelevanceScore(article.title + ' ' + article.description, entities, searchTerms, aiCategories);

                if (relevanceScore > 0) {
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
                        relevance_score: relevanceScore,
                    });
                }
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
