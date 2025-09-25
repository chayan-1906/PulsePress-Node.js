# Article Details Progressive Enhancement API - Implementation Plan

## Overview

Implement `/article-details/enhance/{articleId}` endpoint for progressive enhancement in ArticleDetailsScreen (in-app browser view) with immediate cached response and background AI processing.

**Important Context**: The `articleId`, `articleUrl` parameter will come from articles previously fetched via `/multi-source/enhance` API, The article may or may not exist in the ArticleEnhancement
schema. If it doesn't exist, then the

## 1. API Endpoint Design ✅

### 1.1 Route Definition ✅

- **Endpoint**: `POST /news/article/enhance`
- **Route File**: `src/routes/NewsRoutes.ts`
- **Controller Method**: `fetchArticleDetailsEnhancementController`

### 1.2 Request Parameters ✅

```typescript
interface IArticleDetailsEnhanceParams {
    email?: string;   // for authMiddleware
    articleId: string;
    articleUrl: string;
}
```

### 1.3 Response Structure ✅

```typescript
import {TSentimentResult} from "./ai";
import {TProcessingStatus} from "./news";

interface IArticleDetailsEnhanceResponse {
    articleId: string;
    url: string;
    processingStatus: TProcessingStatus;
    enhanced: boolean;
    enhancements: {
        tags?: string[];
        sentiment?: TSentimentResult;
        keyPoints?: string[];
        complexityMeter?: TComplexityMeter;
        locations?: string[];
        questions?: string[];
        summaries?: Map<string, ISummaryVariation>;
        socialMediaCaptions?: Map<string, ICaptionVariation>;
        newsInsights?: INewsInsights;
    };
    progress: number; // 0-100
    message?: string;
    error?: string;
}
```

**CURRENT IMPLEMENTATION ONLY RETURNS:**

```typescript
// Wrapped in ApiResponse
{
    success: boolean;
    message: string;
    articleDetails: {
        enhanced: boolean;
        progress: number;
        error ? : string;
    }
}
```

## 2. Authentication & Authorization Flow ✅

### 2.1 Auth Token Handling ✅

- **Valid Token + Authenticated User**: Process missing enhancements + return cached data
- **No Token**/**Blocked User**/**Invalid Token**: Return only cached data (no AI processing)

### 2.2 User Validation Logic ✅

```typescript
// Follow same pattern as /multi-source APIs
const authResult = await AuthMiddleware.validateToken(req);
const userEmail = authResult?.email;

if (userEmail) {
    const {isBlocked} = await StrikeService.checkUserBlock({email: userEmail});
    const canProcessEnhancements = !isBlocked;
} else {
    const canProcessEnhancements = false; // No auth = cache only
}
```

## 3. Progressive Enhancement Logic ✅

### 3.1 Cache-First Response Strategy ✅

1. **Immediate Response**: Always return cached enhancements first (if any)
2. **Background Processing**: Start AI enhancement for missing features (if authenticated)
3. **Non-Blocking**: Don't wait for AI completion before responding

### 3.2 Enhancement Processing Flow ✅

**TESTING REVEALED**: Background processing works for articles with existing partial enhancements (57% → 100%), but does NOT work for completely new articles (0% → 0%). New articles remain at 0%
progress indefinitely.

```typescript
async function processArticleDetailsEnhancement(articleId: string, userEmail?: string) {
    // 1. Get cached enhancements immediately
    const cachedEnhancements = await getCachedArticleEnhancements(articleId);

    // 2. Determine missing enhancements
    const missingEnhancements = identifyMissingEnhancements(cachedEnhancements);

    // 3. Return cached data immediately
    const response = buildResponseFromCache(cachedEnhancements);

    // 4. If authenticated and missing enhancements exist, process in background
    if (userEmail && missingEnhancements.length > 0) {
        processEnhancementsInBackground(articleId, missingEnhancements, userEmail);
    }

    return response;
}
```

### 3.3 Missing Enhancement Detection ✅

```typescript
function identifyMissingEnhancements(cached: IArticleEnhancement | null): string[] {
    if (!cached) return ['all']; // No cache = need everything

    const missing: string[] = [];
    if (!cached.tags) missing.push('tags');
    if (!cached.sentiment) missing.push('sentiment');
    if (!cached.keyPoints) missing.push('keyPoints');
    if (!cached.complexityMeter) missing.push('complexityMeter');
    if (!cached.questions) missing.push('questions');
    if (!cached.locations) missing.push('locations');
    if (!cached.caption) missing.push('caption');
    if (!cached.newsInsights) missing.push('newsInsights');

    return missing;
}
```

## 4. Background AI Processing ✅

**RACE CONDITION ISSUE**: Missing `activeJobs` duplicate prevention - multiple rapid calls to same article can trigger multiple AI processing jobs, wasting quota.

**NEW ARTICLE BUG**: Background processing fails for completely new articles. Likely failure points:

- Quota reservation issues
- Article scraping failures
- AI processing silent failures
- Database save operation failures

### 4.1 Asynchronous Enhancement Processing ✅

- **Pattern**: Use existing `ArticleEnhancementService.aiEnhanceArticle` method with tasks array for single AI call
- **Storage**: Update existing ArticleEnhancement document with new data from combined AI response
- **Error Handling**: Failed AI processing shouldn't affect cached data, partial enhancement results are acceptable

### 4.2 Article Content Resolution ✅

**ISSUE**: Content scraping may be failing for new articles, causing background processing to abort silently.

```typescript
import {getCachedArticleEnhancements} from "./cacheHelpers";

async function getArticleContentForProcessing(articleId: string, articleUrl: string): Promise<{ url: string, content: string } | null> {
    // First check if article data exists in cache
    const cachedEnhancement = await getCachedArticleEnhancements(articleId);
    if (cachedEnhancement?.url) {
        // Article URL exists in cache, fetch content
        const content = await fetchArticleContent(cachedEnhancement.url);
        return {url: cachedEnhancement.url, content};
    } else {
        // Scrape article to get the content
        const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [articleUrl]});

        //  Cache it
        return {url: articleUrl, content: scrapedArticles[0]};
    }
}
```

### 4.3 Service Integration ✅

**CRITICAL ISSUE**: The implementation lacks `activeJobs.has(articleId)` check before starting background processing, allowing multiple AI calls for the same article.

```typescript
async function processEnhancementsInBackground(articleId: string, missing: string[], email: string) {
    // Don't await - fire and forget background processing
    setImmediate(async () => {
        try {
            // Get article content for AI processing
            const articleData = await getArticleContentForProcessing(articleId);
            if (!articleData) {
                console.error('Cannot process enhancements: article content not found', {articleId});
                await updateArticleProcessingStatus(articleId, 'failed');
                return;
            }

            // Use existing ArticleEnhancementService.aiEnhanceArticle with tasks array
            const aiResult = await ArticleEnhancementService.aiEnhanceArticle({
                content: articleData.content,
                tasks: missing, // Pass all missing enhancements in single AI call
                selectedModel: selectedModel, // Use quota-managed model selection
            });

            // Save all enhancements from single AI response
            if (!aiResult.error) {
                await saveEnhancementsToCache(articleId, articleData.url, aiResult, missing);
            }

            // Update processing status to completed
            await updateArticleProcessingStatus(articleId, 'completed');
        } catch (error) {
            console.error('Background enhancement failed', error);
            await updateArticleProcessingStatus(articleId, 'failed');
        }
    });
}
```

### 4.4 Batch Enhancement Processing ✅

```typescript
async function saveEnhancementsToCache(articleId: string, url: string, aiResult: ICombinedAIResponse, requestedTasks: string[]) {
    try {
        const enhancementsToCache: any = {
            articleId,
            url,
        };

        // Only save enhancements that were requested and successfully generated
        if (requestedTasks.includes('tags') && aiResult.tags) {
            enhancementsToCache.tags = aiResult.tags;
        }
        if (requestedTasks.includes('sentiment') && aiResult.sentiment) {
            enhancementsToCache.sentiment = aiResult.sentiment;
        }
        if (requestedTasks.includes('keyPoints') && aiResult.keyPoints) {
            enhancementsToCache.keyPoints = aiResult.keyPoints;
        }
        if (requestedTasks.includes('complexityMeter') && aiResult.complexityMeter) {
            enhancementsToCache.complexityMeter = aiResult.complexityMeter;
        }
        if (requestedTasks.includes('locations') && aiResult.locations) {
            enhancementsToCache.locations = aiResult.locations;
        }
        if (requestedTasks.includes('questions') && aiResult.questions) {
            enhancementsToCache.questions = aiResult.questions;
        }
        if (requestedTasks.includes('newsInsights') && aiResult.newsInsights) {
            enhancementsToCache.newsInsights = aiResult.newsInsights;
        }

        // Use existing saveBasicEnhancements function to update cache
        if (Object.keys(enhancementsToCache).filter(key => key !== 'articleId' && key !== 'url').length > 0) {
            await saveBasicEnhancements(enhancementsToCache);
            console.log('Background enhancements cached successfully'.cyan, {articleId, enhancementTypes: Object.keys(enhancementsToCache)});
        }
    } catch (error) {
        console.error('Failed to save background enhancements to cache', {articleId, error: error.message});
    }
}
```

## 5. Controller Implementation ✅

### 5.1 Main Controller Method ✅

**ACTUAL IMPLEMENTATION** returns only `{enhanced, progress, error?}` wrapped in ApiResponse, missing all planned fields.

```typescript
async
fetchArticleDetailsEnhancementController(req
:
Request, res
:
Response
)
{
    try {
        const {articleId} = req.params;

        // Validate articleId
        if (!articleId) {
            return res.status(400).json({error: generateMissingCode('articleId')});
        }

        // Auth validation (following same pattern as /multi-source APIs)
        const authResult = await AuthMiddleware.validateToken(req);
        const userEmail = authResult?.email;

        // Check if user can process enhancements (same logic as /multi-source APIs)
        let canProcessEnhancements = false;
        if (userEmail) {
            const {isBlocked} = await StrikeService.checkUserBlock({email: userEmail});
            canProcessEnhancements = !isBlocked;
        }

        // Get cached enhancements (always return cached data regardless of auth)
        const cachedEnhancements = await getCachedArticleEnhancements(articleId);

        // Handle case where articleId doesn't exist in cache and no URL available
        if (!cachedEnhancements?.url && canProcessEnhancements) {
            return res.status(404).json({error: generateNotFoundCode('article')});
        }

        // Build response from cache
        const response = buildEnhancementResponse(cachedEnhancements, articleId);

        // Start background processing if needed (only for authenticated, non-blocked users)
        if (canProcessEnhancements && hasIncompleteEnhancements(cachedEnhancements)) {
            processArticleEnhancementsInBackground(articleId, userEmail);
        }

        return res.status(200).json(response);
    } catch (error) {
        console.error('Article details enhancement failed', error);
        return res.status(500).json({error: 'INTERNAL_SERVER_ERROR'});
    }
}
```

## 6. Helper Functions ✅

### 6.1 Response Builder ✅

```typescript
function buildEnhancementResponse(cached: IArticleEnhancement | null, articleId: string) {
    const processingStatus = cached?.processingStatus || 'pending';
    const enhanced = processingStatus === 'completed';

    return {
        articleId,
        url: cached?.url || '',
        processingStatus,
        enhanced,
        enhancements: {
            tags: cached?.tags,
            sentiment: cached?.sentiment,
            keyPoints: cached?.keyPoints,
            complexityMeter: cached?.complexityMeter,
            locations: cached?.locations,
            questions: cached?.questions,
            summaries: cached?.summaries,
            socialMediaCaptions: cached?.socialMediaCaptions,
            newsInsights: cached?.newsInsights,
        },
        progress: calculateProgress(cached),
    };
}
```

### 6.2 Progress Calculation ✅

```typescript
function calculateProgress(cached: IArticleEnhancement | null): number {
    if (!cached) return 0;

    const totalFeatures = 8; // tags, sentiment, keyPoints, complexityMeter, locations, questions, newsInsights, summaries
    let completedFeatures = 0;

    if (cached.tags) completedFeatures++;
    if (cached.sentiment) completedFeatures++;
    if (cached.keyPoints) completedFeatures++;
    if (cached.complexityMeter) completedFeatures++;
    if (cached.locations) completedFeatures++;
    if (cached.questions) completedFeatures++;
    if (cached.newsInsights) completedFeatures++;
    if (cached.summaries && cached.summaries.size > 0) completedFeatures++;

    return Math.round((completedFeatures / totalFeatures) * 100);
}
```

## 7. Integration Points ✅

### 7.1 Route Registration ✅

```typescript
// In src/routes/NewsRoutes.ts
router.post('/article/enhance', NewsController.fetchArticleDetailsEnhancementController);
```

### 7.2 Cache Helper Extensions ✅

- Extend existing `cacheHelpers.ts` functions
- Add individual enhancement save functions
- Ensure compatibility with existing ArticleEnhancement schema

### 7.3 Service Method Reuse ✅

- Leverage existing AI service methods
- Use same authentication patterns
- Maintain quota management for background processing

## 8. Error Handling ✅

### 8.1 Error Scenarios ✅

- **Invalid articleId**: Return 400 with missing code
- **Cache read failure**: Log warning, continue with empty cache
- **Background processing failure**: Log error, don't affect response
- **Individual enhancement failure**: Skip failed enhancement, continue others

### 8.2 Graceful Degradation ✅

- Always return cached data when available
- Partial enhancements are acceptable
- Individual feature failures don't block entire response

## 9. Testing Strategy ✅

### 9.1 Test Cases ✅

- **Authenticated user + no cache**: Background processing starts
- **Authenticated user + partial cache**: Missing enhancements processed
- **Authenticated user + complete cache**: Immediate response, no processing
- **Unauthenticated user + cache**: Cache-only response
- **Blocked user + cache**: Cache-only response
- **Invalid articleId**: Proper error response

### 9.2 Performance Testing ✅

- Response time for cached data (should be < 100ms)
- Background processing doesn't block response
- Memory usage with concurrent requests

## 10. File Structure ✅

### 10.1 New/Modified Files ✅

- `src/controllers/NewsController.ts` - Add new controller method
- `src/routes/NewsRoutes.ts` - Add new route
- `src/services/ArticleEnhancementService.ts` - Add progressive enhancement logic
- `src/utils/serviceHelpers/cacheHelpers.ts` - Extend with individual save functions
- `src/types/news.ts` - Add response interfaces

### 10.2 No New Dependencies ✅

- Reuse existing authentication middleware
- Reuse existing AI services
- Reuse existing cache infrastructure
- Reuse existing error handling patterns

---

## 🚨 CRITICAL SYSTEM-WIDE AI MODEL FALLBACK ISSUE

### ISSUE DISCOVERED ⚠️

A critical system-wide vulnerability affects **ALL AI services** in the application. When QuotaService selects an AI model that subsequently fails at the AI call level (e.g., model not found, model
deprecated), the services fail completely without attempting fallback models.

### REPRODUCTION TEST ❌

**Deliberate Test**: User intentionally modified AI model name from `gemini-2.5-flash` to `gemini-2.5-flash-li` (invalid)

**Error Result**:

```
selectedModel: 'gemini-2.5-flash-li'
[GoogleGenerativeAI Error]: [404 Not Found] models/gemini-2.5-flash-li is not found
❌ Background processing failed: AI enhancement error
```

**Expected Behavior**: Should automatically try the next model in the fallback list
**Actual Behavior**: Complete failure, no retry mechanism

### ✅ SOLUTION IMPLEMENTED

**Centralized AI fallback system implemented in QuotaService with SentimentAnalysisService migrated as demonstration.**

#### REMAINING SERVICES TO MIGRATE (12+ services)

Replace old 2-step pattern with new 1-step pattern in these services:

1. **SentimentAnalysisService** ✅
2. **TagGenerationService.ts** ✅
3. **SummarizationService.ts** ✅
4. **SocialMediaCaptionService.ts** ✅
5. **QuestionAnswerService.ts** ✅
6. **NewsInsightsService.ts** ✅
7. **NewsClassificationService.ts**
8. **KeyPointsExtractionService.ts**
9. **GeographicExtractionService.ts**
10. **ComplexityMeterService.ts**
11. **ArticleEnhancementService.ts** (2 locations) ✅

**Migration Pattern** (follow SentimentAnalysisService example):

```typescript
// OLD (remove)
const quotaReservation = await QuotaService.reserveQuotaForModelFallback({...});
const result = await this.methodWithGemini(quotaReservation.selectedModel, content);

// NEW (replace with)
const fallbackResult = await QuotaService.executeWithModelFallback({
    primaryModel: SERVICE_MODELS[0],
    fallbackModels: SERVICE_MODELS.slice(1),
    executeAICall: (modelName: string) => this.methodWithGemini(modelName, content),
    count: 1,
});

if (!fallbackResult.success) {
    if (fallbackResult.error === 'QUOTA_EXHAUSTED') {
        return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
    }
    return {error: 'SERVICE_SPECIFIC_FAILED'};
}
const result = fallbackResult.result!;
```
