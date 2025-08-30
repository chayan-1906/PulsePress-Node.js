# PulsePress Refactoring Plan

## 1. ✅ Rename the functions properly (ALREADY GOOD)

**Status:** ✅ **COMPLETE - No changes needed**

Your function names are already consistent and descriptive:
- `fetchNewsAPIOrgTopHeadlinesController` ✓
- `fetchGuardianNewsController` ✓  
- `registerUserController` ✓

All controller functions have `Controller` suffix. **No action required.**

---

## 2. ✅ Add class in all the service files

**Status:** ❌ **NEEDS WORK - Some services are not classes**

**Current Issues:**
Most services use classes, but some are function-based:

```typescript
// ❌ Function-based services (need to convert to classes)
// services/AIService.ts
export const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
export const AI_MODEL = 'gemini-1.5-flash';
export const summarizeArticle = async (...) => { }

// services/MagicLinkService.ts  
export const generateMagicLink = async (...) => { }
export const verifyMagicLink = async (...) => { }
export const checkAuthStatus = async (...) => { }

// services/HealthService.ts
// (Also function-based exports)
```

**Fix:** Convert function-based services to classes:
```typescript
// ✅ Convert to class-based
// services/AIService.ts
class AIService {
    static readonly genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
    static readonly AI_MODEL = 'gemini-1.5-flash';
    
    static async summarizeArticle(...) { }
}

// services/MagicLinkService.ts
class MagicLinkService {
    static async generateMagicLink(...) { }
    static async verifyMagicLink(...) { }
    static async checkAuthStatus(...) { }
}
```

**Action:** Convert AIService, MagicLinkService, and HealthService from function exports to class-based services.

---

## 3. ✅ Make things consistent — console.log, console.error, when to use which color

**Current Issues:**
```typescript
// ❌ Mixed console patterns throughout codebase
console.info('registerUserController called'.bgMagenta.white.italic);
console.error('ERROR: inside catch of fetchTopHeadlines:'.red.bold, error);
console.log('topHeadlines from NewsAPIOrg:'.cyan.italic, topHeadlinesResponse);
console.time('RSS_FETCH_TIME'.bgMagenta.white.italic);
console.warn('Guardian API key not configured'.yellow.italic);
```

**Fix:** Create standardized logging patterns:
```typescript
// ✅ Standardized patterns to implement
console.info('Controller: registerUserController started'.bgBlue.white);
console.error('Service Error: fetchTopHeadlines failed:'.red.bold, error);
console.log('API Response: NewsAPIOrg success'.green, data);  
console.warn('Config Warning: Guardian API key missing'.yellow);
console.time('Performance: RSS_FETCH_TIME'.cyan);
```

**Action:** Go through all files and standardize console statements using the patterns above.

---

## 4. ✅ Add context in "Something went wrong"

**Current Problem:**
```typescript
// ❌ Generic error messages everywhere
res.status(500).send(new ApiResponse({
    success: false,
    error,
    errorMsg: 'Something went wrong', // ❌ Not helpful!
}));
```

**Occurrences:** Found in 15+ controller methods like:
- `fetchNewsAPIOrgTopHeadlinesController`
- `registerUserController`
- `toggleBookmarkController`

**Fix:** Add specific context:
```typescript
// ✅ Specific error messages
res.status(500).send(new ApiResponse({
    success: false,
    error,
    errorMsg: 'Failed to fetch news headlines from NewsAPI', // ✅ Helpful!
}));

res.status(500).send(new ApiResponse({
    success: false,
    error,
    errorMsg: 'User registration failed during database save', // ✅ Specific!
}));
```

**Action:** Replace all generic "Something went wrong" with specific error context.

---

## 5. TODO: Standardize all function names to camelCase

**Current Issues:**
```typescript
// ❌ Mixed naming patterns in services
class NewsService {
    static async fetchNewsAPIOrgTopHeadlines() // ❌ Contains acronym
    static async fetchNYTimesNews()         // ❌ Contains acronym  
    static async fetchGuardianNews()        // ✅ Good
}

class AuthService {
    static async getUserByEmail()           // ✅ Good
    static async createMagicLink()          // ✅ Good
}
```

**Fix:** Standardize to camelCase without acronyms:
```typescript
// ✅ Standardized naming
class NewsService {
    static async fetchNewsApiTopHeadlines()    // ✅ camelCase
    static async fetchNewYorkTimesNews()       // ✅ camelCase
    static async fetchGuardianNews()           // ✅ Already good
}
```

**Action:** Rename service methods to pure camelCase, avoiding acronyms like NEWSORG, NYTimes.

---

## 6. ✅ Refactor: Consistent interface names

**Current Issues:**
```typescript
// ❌ Inconsistent interface naming
interface NEWSORGTopHeadlinesParams        // ❌ Acronym, no I prefix
interface NYTimesSearchParams             // ❌ Acronym, no I prefix
interface GuardianSearchParams            // ❌ No I prefix
interface MultisourceFetchNewsParams      // ❌ No I prefix
interface Article                         // ❌ No I prefix
interface GuardianArticle                 // ❌ No I prefix
```

**Fix:** Standardize interface names with I prefix and no acronyms:
```typescript
// ✅ Consistent naming
interface INewsApiTopHeadlinesParams       // ✅ I prefix + no acronyms
interface INewYorkTimesSearchParams        // ✅ I prefix + full name
interface IGuardianSearchParams            // ✅ I prefix + descriptive
interface IMultisourceFetchNewsParams      // ✅ I prefix + descriptive
interface IArticle                         // ✅ I prefix
interface IGuardianArticle                 // ✅ I prefix
```

**Action:** 
1. Add `I` prefix to all interface names
2. Remove acronyms and use descriptive names
3. Update all imports and usages throughout the codebase

---

## 7. ✅ Refactor: Move helper functions somewhere else than service functions

**Current Issues:**
```typescript
// ❌ Helper functions mixed with business logic in NewsService
class NewsService {
    // ❌ These are utilities, not business logic
    private static convertGuardianToArticle()
    private static convertNYTimesToArticle() 
    private static assessContentQuality()
    private static generateQueryVariations()
    private static isDuplicateArticle()
    private static cleanScrapedText()
    
    // ✅ These belong in service
    static async fetchMultiSourceNews()
    static async scrapeMultipleArticles()
}
```

**Fix:** Move utilities to dedicated files:
```typescript
// ✅ Create new utility files
// utils/articleConverters.ts
export const convertGuardianToArticle = () => { }
export const convertNyTimesToArticle = () => { }

// utils/articleQuality.ts  
export const assessContentQuality = () => { }
export const isDuplicateArticle = () => { }

// utils/textProcessing.ts
export const cleanScrapedText = () => { }
export const generateQueryVariations = () => { }
```

**Action:** Extract helper functions from services into focused utility files.

---

## 8. ✅ Caching & Reset Quota (MongoDB → Alternative to Redis)

**Current Issues:**
```typescript
// ❌ In-memory caches that reset on server restart
const RSS_CACHE = new Map<string, { data: RSSFeed[], timestamp: number }>();
const TOPHEADLINES_CACHE = new Map<string, { data: any, timestamp: number }>();
const GUARDIAN_CACHE = new Map<string, { data: any, timestamp: number }>();

// ❌ In-memory counters that reset
let newsApiRequestCount = 0;
let guardianApiRequestCount = 0;
```

**Fix:** Use MongoDB for persistent caching:
```typescript
// ✅ Create MongoDB schemas for caching
// models/ApiCacheSchema.ts
const ApiCacheSchema = new Schema({
    key: String,
    data: Object,
    expiresAt: Date,
});

// models/ApiQuotaSchema.ts  
const ApiQuotaSchema = new Schema({
    service: String, // 'newsapi', 'guardian', 'nytimes'
    requestCount: Number,
    resetDate: Date,
});
```

**Action:** Replace in-memory caches and counters with MongoDB-based persistence.

---

## 9. ✅ Add powered_by in AI Interfaces

**Current Issues:**
```typescript
// ❌ AI responses don't indicate which model was used
return {
    sentiment: result.sentiment,
    confidence: result.confidence
    // ❌ Missing model attribution
};
```

**Fix:** Add powered_by as string to all AI responses (following summarizeArticle pattern):
```typescript
// ✅ Add model attribution as string
return {
    sentiment: result.sentiment,
    confidence: result.confidence,
    powered_by: 'gemini-2.0-flash'  // ✅ Simple string format
};

// Example from summarizeArticle (FOLLOW THIS PATTERN):
return {
    summary: summary,
    powered_by: modelName  // ✅ Already implemented correctly
};
```

**Action:** Add `powered_by: string` field to all AI service responses, following the same pattern as summarizeArticle.

---

## 10. ✅ User Strike → Reset strike before permanent block

**Current Issue:**
```typescript
// ❌ No reset mechanism before permanent block
if (userStrike.count >= PERMANENT_BLOCK_THRESHOLD) {
    // User is permanently blocked, no way back
}
```

**Fix:** Add reset mechanism:
```typescript
// ✅ Add reset before permanent block
if (userStrike.count >= WARNING_THRESHOLD) {
    // Send warning: "Your account will be permanently blocked after X more strikes"
    // Offer reset option: "Complete verification to reset strikes"
}

// Add reset method
static async resetUserStrikes(email: string, reason: string) {
    // Reset strikes with proper logging
}
```

**Action:** Implement strike reset mechanism before permanent blocks.

---

## 11. ✅ Fix AuthMiddleware Issues

**Status:** ✅ **COMPLETE - Already fixed!**

You have successfully standardized the AuthMiddleware responses:
```typescript
// ✅ All responses now use consistent ApiResponse format
res.status(401).send(new ApiResponse({
    success: false,
    errorCode: generateMissingCode('auth_token'),
    errorMsg: 'No token provided'
}));

res.status(401).send(new ApiResponse({
    success: false,
    errorCode: generateInvalidCode('auth_token'),
    errorMsg: 'Invalid or expired token'
}));
```

**Action:** ✅ **COMPLETE - No action required**

---

## 12. Replace Hardcoded Values with Constants

**Current Issues (PARTIALLY FIXED):**
You added `API_CONFIG` - great! But more hardcoded values exist:

**Locations of hardcoded values:**
```typescript
// ❌ NewsService.ts - Still hardcoded
pageSize: newsApiTargetCount * 3        // Line ~838 - Use API_CONFIG.NEWS_API.RESULT_MULTIPLIER
threshold: 0.4,                         // Line ~712 - Use API_CONFIG.SEARCH.FUSE_THRESHOLD  
content.substring(0, 4000)              // Line ~41 - Use API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH
pageSize: guardianTargetCount * 3       // Line ~902 - Use API_CONFIG.NEWS_API.RESULT_MULTIPLIER

// ❌ Various AI Services - Content limits
truncatedContent = content.substring(0, 4000)  // Multiple files - Use API_CONFIG

// ❌ Fuse.js configurations
threshold: 0.4,                         // Multiple search configs
minMatchCharLength: 3,                  // Use API_CONFIG.SEARCH.MIN_QUERY_LENGTH

// ❌ Cache durations scattered
Date.now() - cached.timestamp < 300000  // Various files - centralize
```

**Fix:** Replace with centralized constants:
```typescript
// ✅ Use your existing API_CONFIG
pageSize: newsApiTargetCount * API_CONFIG.NEWS_API.RESULT_MULTIPLIER
threshold: API_CONFIG.SEARCH.FUSE_THRESHOLD
content.substring(0, API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH)
minMatchCharLength: API_CONFIG.SEARCH.MIN_QUERY_LENGTH
```

**Action:** 
1. Find all hardcoded multipliers (like `* 3`) and replace with `API_CONFIG.NEWS_API.RESULT_MULTIPLIER`
2. Find all hardcoded thresholds (like `0.4`) and replace with `API_CONFIG.SEARCH.FUSE_THRESHOLD`
3. Find all content length limits (like `4000`) and replace with `API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH`
4. Centralize cache duration checks using `API_CONFIG.SEARCH.CACHE_TTL_MS`

---

## Implementation Order

1. **Quick Fixes (30 min each):**
   - Replace "Something went wrong" messages (item 4)
   - Add powered_by to AI responses (item 9)

2. **Medium Tasks (1-2 hours each):**
   - Convert function-based services to classes (item 2)
   - Standardize console logging (item 3)
   - Replace hardcoded values (item 12)
   - Function/interface renaming (items 5-6)

3. **Larger Refactors (3+ hours each):**
   - Move helper functions (item 7)
   - MongoDB caching system (item 8)
   - User strike reset system (item 10)

---

## Success Criteria

- [ ] All services use class-based structure
- [ ] All console statements follow standard patterns
- [ ] All error messages provide specific context  
- [ ] All function names use camelCase without acronyms
- [ ] All interfaces have I prefix and descriptive names
- [ ] Helper functions separated from business logic
- [ ] Caching persists through server restarts
- [ ] AI responses include model attribution as string
- [ ] Users can reset strikes before permanent blocks
- [ ] No hardcoded values in business logic