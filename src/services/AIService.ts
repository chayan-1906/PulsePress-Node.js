import "colors";
import {createHash} from 'crypto';
import {GoogleGenerativeAI} from "@google/generative-ai";
import {Translate} from '@google-cloud/translate/build/src/v2';
import {isListEmpty} from "../utils/list";
import {getUserByEmail} from "./AuthService";
import {Article, RSSFeed} from "../types/news";
import CachedSummaryModel, {ICachedSummary} from "../models/CachedSummarySchema";
import {fetchAllRSSFeeds, scrapeMultipleArticles, smartFetchNews} from "./NewsService";
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

// TODO: REMOVE
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

const expandQueryWithAI = async ({email, query}: { email: string | undefined; query: string }): Promise<string[]> => {
    try {
        const {user} = await getUserByEmail({email});
        if (user) {
            console.log('user found:'.cyan.italic, user);
            const model = genAI.getGenerativeModel({model: AI_QUERY_PARSING_MODELS[0]});
            const prompt = `Expand this search query with 3-5 related terms for better news search results.
                        Query: "${query}"

                        Return only a JSON array of strings:
                        ["${query}", "synonym1", "synonym2", "related_term1", "related_term2"]
                        
                        Example:
                            Query: "Tesla" → ["Tesla", "electric vehicle", "EV", "Elon Musk", "automotive"]
                            Query: "climate change" → ["climate change", "global warming", "carbon emissions", "greenhouse gases", "environmental"]
                    `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            const jsonMatch = responseText.match(/\[.*]/);
            if (jsonMatch) {
                const expandedTerms = JSON.parse(jsonMatch[0]);
                console.log(`Query expanded: "${query}" → [${expandedTerms.join(', ')}]`.green);
                return expandedTerms;
            }

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

// TODO: REMOVE
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

// TODO: REMOVE
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
        console.log('AI parsed query:'.cyan.italic, {entities, searchTerms, categories, intent, originalQuery, powered_by, recommendedSources});

        // Use smartFetchNews for the main search
        const searchResults = await smartFetchNews({
            q: searchTerms?.slice(0, 3).join(' '),
            sources: recommendedSources?.join(','),
            pageSize: Math.ceil(pageSize * 0.8)
        });

        // Get RSS results for additional context
        let rssResults: RSSFeed[] = [];
        if (recommendedSources && recommendedSources.length > 0) {
            try {
                rssResults = await fetchAllRSSFeeds({
                    sources: recommendedSources.join(','),
                    pageSize: Math.ceil(pageSize * 0.3),
                });
            } catch (error) {
                console.error('RSS fetch failed:'.yellow.italic, error);
            }
        }

        console.log('Smart fetch results:'.blue.italic, {
            articlesCount: searchResults?.articles?.length || 0,
            usedSources: searchResults?.metadata?.usedSources || [],
        });

        console.log('RSS results:'.blue.italic, {
            sources: recommendedSources,
            articlesCount: rssResults.length,
        });

        // Combine and rank results
        const combinedResults = combineAndRank(
            rssResults,
            searchResults || {articles: []},
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
                sourcesUsed: {
                    smartFetch: searchResults?.articles?.length || 0,
                    rss: rssResults.length,
                    filtered: combinedResults.length,
                    usedApis: searchResults?.metadata?.usedSources || []
                }
            },
        };

        // Cache result
        if (NODE_ENV === 'production') {
            SMART_SEARCH_CACHE.set(cacheKey, {data: result, timestamp: Date.now()});
        }

        console.log('Enhanced smart search completed:'.green.italic, {
            query,
            resultsCount: result.articles.length,
            smartFetchCount: searchResults?.articles?.length || 0,
            rssCount: rssResults.length,
            usedApis: searchResults?.metadata?.usedSources || [],
            aiParsed: true,
        });

        return result;
    } catch (error: any) {
        console.error('ERROR: inside catch of processNaturalQuery:'.red.bold, error);
        throw error;
    }
}

// Helper functions
// TODO: REMOVE
const calculateRelevanceScore = (text: string, entities: string[], searchTerms: string[], aiCategories: string[] = []): number => {
    if (!text) return 0;

    const normalizedText = text.toLowerCase();
    let entityScore = 0;
    let termScore = 0;
    let contextScore = 0;
    const matches: string[] = [];

    // Check entities - More selective entity matching
    entities.forEach(entity => {
        const entityLower = entity.toLowerCase();
        if (normalizedText.includes(entityLower)) {
            entityScore += 3;
            matches.push(`"${entity}" (entity)`);

            // Bonus for exact word matches
            if (new RegExp(`\\b${entityLower}\\b`).test(normalizedText)) {
                entityScore += 2; // Increased from 1.5
                matches.push(`"${entity}" (entity word boundary)`);
            }
        }
    });

    // Check search terms (all terms are valuable for relevance)
    searchTerms.forEach(term => {
        const termLower = term.toLowerCase();

        if (normalizedText.includes(termLower)) {
            termScore += 2;
            matches.push(`"${term}" (term)`);

            if (new RegExp(`\\b${termLower}\\b`).test(normalizedText)) {
                termScore += 1;
                matches.push(`"${term}" (term word boundary)`);
            }
        }
    });

    // Smart context matching - balance precision and recall
    if (entities.length > 1 || searchTerms.length > 1) {
        // Extract core concepts (avoid overly specific phrases)
        const coreTerms = [...entities, ...searchTerms]
            .map(term => term.toLowerCase())
            .filter(term => term.length > 2) // Skip very short terms
            .map(term => {
                // Simplify complex entities to core words
                if (term.includes('cricket team')) return 'cricket';
                if (term.includes('test match')) return 'test';
                return term;
            });

        const uniqueCoreTerms = [...new Set(coreTerms)];
        const matchedTerms: string[] = [];

        uniqueCoreTerms.forEach(term => {
            if (normalizedText.includes(term)) {
                matchedTerms.push(term);
            }
        });

        // For multi-term queries, require majority match (60%+)
        const matchRatio = matchedTerms.length / uniqueCoreTerms.length;

        if (matchRatio >= 0.6) { // At least 60% of core terms must match
            contextScore += Math.floor(matchRatio * 3); // Scale bonus based on match ratio
            matches.push(`(context: ${Math.round(matchRatio * 100)}% match - ${matchedTerms.join(', ')})`);
        } else {
            // Light penalty for weak matches
            contextScore -= 2;
            matches.push(`(weak match: only ${Math.round(matchRatio * 100)}% - ${matchedTerms.join(', ')} of ${uniqueCoreTerms.join(', ')})`);
        }
    } else {
        // For single-term queries, basic category matching
        if (aiCategories.length > 0) {
            const categoryTerms = aiCategories.map(cat => cat.toLowerCase());
            const hasRelevantCategory = categoryTerms.some(cat => normalizedText.includes(cat));

            if (hasRelevantCategory) {
                contextScore += 1;
                matches.push('(category match)');
            }
        }
    }

    const totalScore = entityScore + termScore + contextScore;

    // STRICTER FILTERING RULES:
    // 1. Must have at least one entity OR term match with minimum score
    // 2. Must not have negative context score
    // 3. Minimum combined score threshold
    const hasEntityMatch = entityScore > 0;
    const hasTermMatch = termScore > 0;
    const hasPositiveContext = contextScore >= 0;
    const meetsMinimumScore = totalScore >= 3; // Minimum score threshold

    if (!hasEntityMatch && !hasTermMatch) {
        return 0; // No relevant matches
    }

    if (!hasPositiveContext) {
        if (entityScore > 0 || termScore > 0) {
            console.log(`FILTERED OUT (wrong context):`.red.bold);
            console.log(`  Text: "${text.substring(0, 100)}..."`.cyan);
            console.log(`  Matches: ${matches.join(', ')}`.magenta);
            console.log(`  EntityScore: ${entityScore}, TermScore: ${termScore}, ContextScore: ${contextScore}`.blue);
            console.log(`  Total Score: ${totalScore} -> 0 (filtered)`.red.bold);
            console.log('---');
        }
        return 0;
    }

    if (!meetsMinimumScore) {
        console.log(`FILTERED OUT (low score):`.red.bold);
        console.log(`  Text: "${text.substring(0, 100)}..."`.cyan);
        console.log(`  Matches: ${matches.join(', ')}`.magenta);
        console.log(`  EntityScore: ${entityScore}, TermScore: ${termScore}, ContextScore: ${contextScore}`.blue);
        console.log(`  Total Score: ${totalScore} -> 0 (below threshold)`.red.bold);
        console.log('---');
        return 0;
    }

    // Debug logging for accepted articles
    if (totalScore > 0) {
        console.log(`RELEVANCE ACCEPTED:`.green.bold);
        console.log(`  Text: "${text.substring(0, 100)}..."`.cyan);
        console.log(`  Entities: [${entities.join(', ')}]`.green);
        console.log(`  SearchTerms: [${searchTerms.join(', ')}]`.green);
        console.log(`  Categories: [${aiCategories.join(', ')}]`.green);
        console.log(`  Matches: ${matches.join(', ')}`.magenta);
        console.log(`  EntityScore: ${entityScore}, TermScore: ${termScore}, ContextScore: ${contextScore}`.blue);
        console.log(`  Total Score: ${totalScore}`.green.bold);
        console.log('---');
    }

    return totalScore;
}

// TODO: REMOVE
const getRecencyBoost = (publishedAt: string): number => {
    if (!publishedAt) return 0;

    const articleDate = new Date(publishedAt);
    const hoursOld = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);

    return Math.max(0, (24 - hoursOld) / 24);
}

// TODO: REMOVE
const combineAndRank = (rssResults: RSSFeed[], smartFetchResults: any, entities: string[], searchTerms: string[], aiCategories: string[] = []) => {
    const combined: CombinedArticle[] = [];
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>(); // Additional deduplication by title

    console.log('Starting combineAndRank:'.cyan.italic, {
        rssCount: rssResults?.length || 0,
        smartFetchCount: smartFetchResults?.articles?.length || 0,
        entities: entities?.length || 0,
        searchTerms: searchTerms?.length || 0,
        categories: aiCategories?.length || 0
    });

    // Process SmartFetch results first (high priority - already filtered by multiple APIs)
    if (smartFetchResults && smartFetchResults.articles) {
        console.log('Processing SmartFetch results (high priority)...'.yellow.italic);
        smartFetchResults.articles.forEach((article: Article, index: number) => {
            if (!article.url || !article.title) {
                console.log(`Skipping SmartFetch item ${index}: missing URL or title`.yellow);
                return;
            }

            // Normalize URL and title for deduplication
            const normalizedUrl = article.url.toLowerCase().replace(/\/$/, '');
            const normalizedTitle = article.title.toLowerCase().trim();

            if (seenUrls.has(normalizedUrl) || seenTitles.has(normalizedTitle)) {
                console.log(`Skipping SmartFetch duplicate: ${article.title?.substring(0, 50)}...`.yellow);
                return;
            }

            // Add all SmartFetch results with high base score (trust multi-API selection)
            seenUrls.add(normalizedUrl);
            seenTitles.add(normalizedTitle);
            combined.push({
                source: {
                    name: article.source?.name,
                },
                title: article.title,
                url: article.url,
                publishedAt: article.publishedAt,
                content: article.content,
                contentSnippet: article.description,
                source_type: 'smart_fetch',
                relevance_score: 12, // Higher than individual API scores
            });
            console.log(`Added SmartFetch article: ${article.title?.substring(0, 50)}... (score: 12)`.green);
        });
    }

    // Process RSS results with content filtering (apply relevance scoring)
    if (rssResults && Array.isArray(rssResults)) {
        console.log('Processing RSS results (with relevance filtering)...'.blue.italic);
        rssResults.forEach((item: RSSFeed, index) => {
            if (!item.url || !item.title) {
                console.log(`Skipping RSS item ${index}: missing URL or title`.yellow);
                return;
            }

            // Normalize URL and title for deduplication
            const normalizedUrl = item.url.toLowerCase().replace(/\/$/, '');
            const normalizedTitle = item.title.toLowerCase().trim();

            if (seenUrls.has(normalizedUrl) || seenTitles.has(normalizedTitle)) {
                console.log(`Skipping RSS duplicate: ${item.title?.substring(0, 50)}...`.yellow);
                return;
            }

            // Calculate relevance score using title and content snippet
            const textToAnalyze = `${item.title || ''} ${item.contentSnippet || ''}`.trim();
            const relevanceScore = calculateRelevanceScore(textToAnalyze, entities, searchTerms, aiCategories);

            if (relevanceScore > 0) {
                seenUrls.add(normalizedUrl);
                seenTitles.add(normalizedTitle);
                combined.push({
                    ...item,
                    source_type: 'rss',
                    relevance_score: relevanceScore
                });
                console.log(`Added RSS article: ${item.title?.substring(0, 50)}... (score: ${relevanceScore})`.green);
            } else {
                console.log(`Filtered out RSS: ${item.title?.substring(0, 50)}... (score: 0)`.red);
            }
        });
    }

    // Sort by relevance score + recency boost
    const sortedResults = combined.sort((a, b) => {
        const scoreA = a.relevance_score + getRecencyBoost(a.publishedAt || '');
        const scoreB = b.relevance_score + getRecencyBoost(b.publishedAt || '');
        return scoreB - scoreA;
    });

    console.log('combineAndRank completed:'.cyan.italic, {
        totalCombined: combined.length,
        topScores: sortedResults.slice(0, 5).map(r => ({
            title: r.title?.substring(0, 40) + '...',
            score: r.relevance_score,
            type: r.source_type
        }))
    });

    return sortedResults.slice(0, 100); // Return top 100 results
}

export {summarizeArticle, expandQueryWithAI, processNaturalQuery};
