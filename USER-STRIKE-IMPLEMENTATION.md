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
- If last `history.appliedAt` > 1 hour ago � reset strikes to 0
- Uses existing `IStrikeHistoryEvent[]` in UserSchema

### 3. Technical Details ✅

- **Existing**: User schema has `strikes: number` and `history: IStrikeHistoryEvent[]` with `appliedAt: Date`
- **Cooling Period**: 1 hour from last violation
- **Cron Schedule**: `*/15 * * * *` (every 15 minutes)
- **Package**: `npm install node-cron`

### 4. Implementation Steps ✅

1. ✅ Create NonNewsViolationLog model in `/src/models/`
2. ✅ Install & configure node-cron in main server file
3. ✅ Update strike functions to log ALL non-news violations (search, summary, etc.)
4. ✅ Create resetExpiredStrikes() function for cron job
5. ✅ Test the 1-hour cooling-off period

### 5. Benefits

- Users get fresh chances after 1 hour of good behavior
- Admin can track all non-news violations
- Mimics Claude Pro's time-based reset behavior

### 6. Key Functions to Modify ✅

- ✅ Strike increment functions (wherever strikes are applied)
- ✅ Add logging to NonNewsViolationLog collection
- ✅ Create resetExpiredStrikes() cron function

### 7. Missing AI Enhancement Checks ⚠️

**CRITICAL**: The following AI enhancement endpoints are missing news classification checks:

- `generateTagsController`
- `analyzeSentimentController`
- `extractKeyPointsController`
- `analyzeComplexityController`
- `generateQuestionsController`
- `answerQuestionController`
- `extractLocationsController`
- `generateSocialMediaCaptionController`
- `generateNewsInsightsController`

**Code Snippet to Add to Each:**

```typescript
// Add after email extraction, before main logic
const email = (req as IAuthRequest).email;

// Block check
const {isBlocked, blockType, blockedUntil, message: blockMessage} = await StrikeService.checkUserBlock(email);
if (isBlocked) {
    console.warn('Client Error: User is blocked from AI features'.yellow, {email, blockType, blockedUntil});
    res.status(403).send(new ApiResponse({
        success: false,
        errorCode: 'USER_BLOCKED',
        errorMsg: blockMessage || 'You are temporarily blocked from using AI features',
        isBlocked, blockedUntil, blockType,
    }));
    return;
}

// News classification
console.log('External API: Validating news content classification'.magenta);
const classification = await NewsClassificationService.classifyContent(content); // Replace 'content' with actual variable

if (classification === 'error') {
    console.warn('Fallback Behavior: Classification failed, proceeding anyway'.yellow);
} else if (classification === 'non_news') {
    console.warn('Client Error: Non-news content detected, applying user strike'.yellow);
    const {message, newStrikeCount: strikeCount, isBlocked, blockedUntil} = await StrikeService.applyStrike(email, 'ai_enhancement', content);
    res.status(400).send(new ApiResponse({
        success: false, errorCode: 'NON_NEWS_CONTENT', errorMsg: message,
        strikeCount, isBlocked, blockedUntil,
    }));
    return;
} else {
    console.log('News content verified, proceeding with AI enhancement'.bgGreen.bold);
}
```