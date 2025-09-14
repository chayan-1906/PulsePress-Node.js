# Strike and Classification Inconsistencies Analysis

## Detailed Inconsistencies Found

### **1. SentimentAnalysisService - MAJOR INCONSISTENCY**

**File**: `src/services/SentimentAnalysisService.ts`

**Problem**: Missing both content/URL validation patterns that other services have.

**Current Code** (Lines 35-51):

```typescript
let articleContent = content || '';
if (!content && url) {
    console.log('External API: Scraping URL for sentiment analysis'.magenta, {url});
    const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

    if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
        console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
        return {error: 'SCRAPING_FAILED'};
    }

    articleContent = scrapedArticles[0]?.content || '';
}

if (!articleContent || articleContent.trim().length === 0) {
    console.warn('Client Error: Empty content provided for sentiment analysis'.yellow);
    return {error: generateMissingCode('content')};
}
```

**What's Wrong**:

- Missing validation: `if (!content && !url)` check
- Missing validation: `if (content && url)` conflict check
- All other 10 services have these validations

**Expected Code** (should be added after line 33):

```typescript
if (!content && !url) {
    console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
    return {error: 'CONTENT_OR_URL_REQUIRED'};
}

if (content && url) {
    console.warn('Client Error: Content and url both valid'.yellow, {content, url});
    return {error: 'CONTENT_AND_URL_CONFLICT'};
}
```

### **2. Controller Violations - MULTIPLE INCONSISTENCIES**

**File**: `src/controllers/AIController.ts`

**Problem**: Controller performs logic that should be in service layer.

#### **A. analyzeSentimentController** (Lines 331-356)

**Current Code**:

```typescript
let contentToAnalyze = content;

if (!content && url) {
    console.log('External API: Scraping URL for sentiment analysis'.magenta, {url});
    const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

    if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
        res.status(400).send(new ApiResponse({
            success: false,
            errorCode: 'SCRAPING_FAILED',
            errorMsg: 'Failed to scrape the provided URL',
        }));
        return;
    }

    contentToAnalyze = scrapedArticles[0]?.content || '';
}

if (!contentToAnalyze || contentToAnalyze.trim().length === 0) {
    res.status(400).send(new ApiResponse({
        success: false,
        errorCode: generateMissingCode('content'),
        errorMsg: 'Content is required for sentiment analysis',
    }));
    return;
}
```

**What's Wrong**:

- Controller is handling URL scraping (should be in service)
- Controller is validating content (should be in service)
- Controller is making external API calls (should be in service)

#### **B. extractKeyPointsController** (Lines 461-486) - SAME ISSUE

#### **C. analyzeComplexityController** (Lines 588-613) - SAME ISSUE

#### **D. extractLocationsController** (Lines 912-937) - SAME ISSUE

#### **E. generateNewsInsightsController** (Lines 1155-1180) - SAME ISSUE

**Expected Fix**: All these controllers should simply pass `content` and `url` directly to their respective services, just like:

- `classifyContentController`
- `summarizeArticleController`
- `generateTagsController`

---

## Services Following the Rule Correctly

### **COMPLIANT Services (9/11)**:

1. **ComplexityMeterService** - Perfect implementation
2. **GeographicExtractionService** - Perfect implementation
3. **KeyPointsExtractionService** - Perfect implementation
4. **NewsClassificationService** - Perfect implementation
5. **NewsInsightsService** - Perfect implementation
6. **QuestionAnswerService** - Perfect implementation
7. **SocialMediaCaptionService** - Perfect implementation
8. **SummarizationService** - Perfect implementation (special case)
9. **TagGenerationService** - Perfect implementation

**Example Perfect Pattern** (from ComplexityMeterService):

```typescript
static async analyzeComplexity({email, content, url}: IComplexityMeterParams): Promise<IComplexityMeterResponse> {
    console.log('Service: ComplexityMeterService.analyzeComplexity called'.cyan.italic, {email, content, url});

    // 1. Strike check first
    const {isBlocked, blockType, blockedUntil, message: blockMessage} = await StrikeService.checkUserBlock(email);
    if (isBlocked) {
        console.warn('Client Error: User is blocked from AI features'.yellow, {email, blockType, blockedUntil});
        return {
            error: 'USER_BLOCKED',
            message: blockMessage || 'You are temporarily blocked from using AI features',
            isBlocked,
            blockedUntil,
            blockType,
        };
    }

    // 2. Input validation
    if (!content && !url) {
        console.warn('Client Error: Content and url both invalid'.yellow, {content, url});
        return {error: 'CONTENT_OR_URL_REQUIRED'};
    }

    if (content && url) {
        console.warn('Client Error: Content and url both valid'.yellow, {content, url});
        return {error: 'CONTENT_AND_URL_CONFLICT'};
    }

    // 3. Content handling (scraping if needed)
    let articleContent = content || '';
    if (!content && url) {
        console.log('Scraping URL for complexity analysis:'.cyan, url);
        const scrapedArticles = await NewsService.scrapeMultipleArticles({urls: [url]});

        if (isListEmpty(scrapedArticles) || scrapedArticles[0].error) {
            console.error('Service Error: Scraping failed:'.red.bold, scrapedArticles[0]?.error);
            return {error: 'SCRAPING_FAILED'};
        }

        articleContent = scrapedArticles[0]?.content || '';
    }

    // 4. Content validation
    if (!articleContent || articleContent.trim().length === 0) {
        console.warn('Client Error: Empty content provided for complexity analysis'.yellow);
        return {error: generateMissingCode('content')};
    }

    // 5. News classification
    console.log('External API: Validating news content classification'.magenta);
    const classification = await NewsClassificationService.classifyContent(articleContent);

    if (classification === 'error') {
        console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
    } else if (classification === 'non_news') {
        console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
        const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike(email, 'ai_enhancement', articleContent);
        return {error: 'NON_NEWS_CONTENT', message, strikeCount, isBlocked, blockedUntil};
    } else {
        console.log('News content verified, proceeding with complexity analysis'.bgGreen.bold);
    }

    // 6. AI processing continues...
}
```

---

## Non-Compliant Services & Controllers

### **NON-COMPLIANT (2/11)**:

1. **SentimentAnalysisService** - Missing input validation patterns
2. **Controller Functions** - Multiple functions doing service-layer work

---
