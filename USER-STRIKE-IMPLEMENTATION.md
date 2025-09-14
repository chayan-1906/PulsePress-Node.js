# USER STRIKE IMPLEMENTATION IMPROVEMENTS

## Context

This is a news aggregation app where users can search for news. To prevent misuse, we have a strike system that blocks users who search for non-news content.

## Current Issues

- Strikes only reset after hitting blocks (15m temp / 48h permanent)
- No logging of non-news violations for admin tracking
- No "cooling off" period for good behavior

## New Implementation Plan

### 1. NonNewsViolationLog Schema ✅

```typescript
{
  userId: ObjectId,
  userExternalId: string,
  email: string, 
  violationType: string, // 'search_query', 'article_summary', etc.
  content: string, // actual query/content that violated
  violatedAt: Date
}
```

### 2. Auto-Reset Mechanism (node-cron) ✅

- Cron job runs every 15 minutes
- Check users with `strikes > 0`
- If last `history.appliedAt` > 1 hour ago reset strikes to 0
- Uses existing `IStrikeHistoryEvent[]` in UserSchema

### 3. Technical Details ✅

- **Existing**: User schema has `strikes: number` and `history: IStrikeHistoryEvent[]` with `appliedAt: Date`
- **Cooling Period**: 1 hour from last violation
- **Cron Schedule**: `*/15 * * * *` (every 15 minutes)
- **Package**: `npm install node-cron`

### 4. Implementation Steps ✅

1. ✅ Create NonNewsViolationLog model in `/src/models/` (with enum types)
2. ✅ Install & configure node-cron in main server file
3. ✅ Update strike functions to log ALL non-news violations (search, summary, etc.)
4. ✅ Create resetExpiredStrikes() function for cron job
5. ✅ Test the 1-hour cooling-off period (TESTED & WORKING)
6. ✅ Fix missing authentication on /classify endpoint
7. ✅ Add server downtime handling (auto-reset on API calls)

### 5. Benefits ✅

- ✅ Users get fresh chances after 1 hour of good behavior
- ✅ Admin can track all non-news violations (NonNewsViolationLog collection)
- ✅ Mimics Claude Pro's time-based reset behavior
- ✅ Graceful server downtime handling
- ✅ Dual reset mechanism (1-hour + 2-day backup)

### 6. Key Functions to Modify ✅

- ✅ Strike increment functions (wherever strikes are applied)
- ✅ Add logging to NonNewsViolationLog collection
- ✅ Create resetExpiredStrikes() cron function

### 7. AI Enhancement Strike Implementation Status ✅

**ARCHITECTURE**: Strike checks implemented at **service layer** (not controller layer) for better separation of concerns.

**COMPLETED** (ALL 11 AI SERVICES FULLY IMPLEMENTED):

- ✅ `NewsClassificationService.classifyContentWithStrikeHandling()` (Service layer implementation)
- ✅ `SummarizationService.summarizeArticle()` (Service layer implementation)
- ✅ `TagGenerationService.generateTags()` (Service layer implementation)
- ✅ `SentimentAnalysisService.analyzeSentiment()` (Service layer implementation)
- ✅ `KeyPointsExtractionService.extractKeyPoints()` (Service layer implementation)
- ✅ `ComplexityMeterService.analyzeComplexity()` (Service layer implementation)
- ✅ `QuestionAnswerService.generateQuestions()` (Service layer implementation)
- ✅ `QuestionAnswerService.answerQuestion()` (Service layer implementation)
- ✅ `GeographicExtractionService.extractLocations()` (Service layer implementation)
- ✅ `SocialMediaCaptionService.generateCaption()` (Service layer implementation)
- ✅ `NewsInsightsService.generateInsights()` (Service layer implementation)

**STATUS**: 🎉 **100% COMPLETE** - All AI services now have consistent user block checking and news classification at the service layer.

**IMPLEMENTATION PATTERN** (Service Layer):

1. Update service interface to include `email` parameter
2. Add block check at start of service method
3. Add news classification after content processing
4. Return strike information in error responses
5. Update controller to handle new response format
