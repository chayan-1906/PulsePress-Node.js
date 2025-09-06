# API Quota Management - Critical Issue Analysis & Solution Plan

### **Current Problem Analysis**

#### **SummarizationService.ts (Lines 31-36)**
```typescript
static geminiRequestCount = 0;
private static resetInterval = setInterval(() => {
    this.geminiRequestCount = 0;
    console.log('Daily Gemini API counter reset'.blue);
}, Number.parseInt(GEMINI_QUOTA_MS!));
```

#### **NewsService.ts (Lines 47-56)**
```typescript
let newsApiRequestCount = 0;
let guardianApiRequestCount = 0;
let nytimesApiRequestCount = 0;

setInterval(() => {
    newsApiRequestCount = 0;
    guardianApiRequestCount = 0;
    nytimesApiRequestCount = 0;
    console.log('Daily API counters reset'.blue);
}, Number.parseInt(NEWSAPIORG_QUOTA_MS!));
```

### **Why This Is Broken**

1. **Server Restarts**: Every deployment/crash/restart resets counters to 0
2. **Horizontal Scaling**: Multiple server instances = multiple independent counters
3. **Development Restarts**: Frequent `npm run dev` restarts bypass all quotas
4. **No Persistence**: Memory-only storage means no historical tracking
5. **Silent Failures**: No way to debug actual usage vs. perceived usage

### **Real-World Impact**

-  **What you thought**: "I'm within free tier limits"
- **Reality**: Unlimited API calls after every restart
- **Result**: ₹140 unexpected charge from Google

## **Solution: MongoDB-Based Quota Management**

-  No additional infrastructure complexity
-  Uses existing MongoDB connection
-  Persistent across server restarts
-  Easy to query and debug
-  Historical usage tracking
-  Cost-effective for learning

### **Implementation Plan**

#### **Phase 1: Database Schema**

```typescript
// src/models/ApiQuotaSchema.ts
interface IApiQuota {
    service: 'gemini' | 'newsapi' | 'guardian' | 'nytimes' | 'google_translate';
    date: string; // YYYY-MM-DD format
    requestCount: number;
    lastResetAt: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
```

#### **Phase 2: Quota Service**

```typescript
// src/services/QuotaService.ts
class QuotaService {
    static async incrementCounter(service: string): Promise<{allowed: boolean, currentCount: number}>;
    static async getCurrentCount(service: string): Promise<number>;
    static async resetDailyCounters(): Promise<void>; // Cron job
    static async getUsageHistory(service: string, days: number): Promise<IApiQuota[]>;
}
```

#### **Phase 3: Integration Points**

**Replace in SummarizationService.ts:**
```typescript
// L OLD
if (this.geminiRequestCount >= Number.parseInt(GEMINI_QUOTA_REQUESTS!)) {
    return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
}
this.geminiRequestCount++;

//  NEW
const {allowed, currentCount} = await QuotaService.incrementCounter('gemini');
if (!allowed) {
    return {error: 'GEMINI_DAILY_LIMIT_REACHED'};
}
```

### **Migration Strategy**

#### **Step 1: Create Models & Service**
- Create `ApiQuotaSchema.ts`
- Create `QuotaService.ts`
- Add database indexes for performance

#### **Step 2: Replace SummarizationService**
- Remove in-memory counters
- Integrate QuotaService
- Test quota enforcement

#### **Step 3: Replace NewsService**
- Same approach for news API counters
- Consolidate quota logic

#### ** Implementation Order**
1. Database schema (1 day)
2. QuotaService implementation (1 day)  
3. SummarizationService integration (0.5 day)
4. NewsService integration (0.5 day)
5. Testing & validation (1 day)

### **Additional Considerations**

#### **Performance Optimization**
- Cache quota data in memory for 1-minute intervals
- Batch database updates to reduce write operations
- Use MongoDB aggregation for usage analytics

#### **Error Handling**
- Graceful fallback if quota service fails
- Detailed logging for quota violations
- User-friendly error messages

#### **Testing Strategy**
- Unit tests for quota logic
- Integration tests with database
- Load testing for concurrent requests

### **Cost Estimation**

**Before Fix:**
- Unlimited API usage = Unpredictable costs
- Recent bill: ₹140 for 1 month

**After Fix:**
- Predictable usage within free tiers
- Estimated cost: ₹0-50/month (well within free limits)

### **🔍 Gemini API Free Tier Research (September 2025)**

#### **Current Free Tier Limits (Per Project)**
Based on official Google AI documentation:

| Model | RPM | TPM | RPD | Notes |
|-------|-----|-----|-----|-------|
| **gemini-2.5-pro** | 5 | 250K | **100** | Most restrictive |
| **gemini-2.5-flash** | 10 | 250K | **250** | Balanced option |
| **gemini-2.5-flash-lite** | 15 | 250K | **1,000** | 🎯 **Best for production** |
| **gemini-2.0-flash** | 15 | 1M | **200** | Good performance |
| **gemini-2.0-flash-lite** | 30 | 1M | **200** | Fastest RPM |
| **gemini-2.5-flash-lite-preview-06-17** | ? | ? | **N/A** | Preview model, no free tier |

#### **Key Research Insights:**

**1. Quota Structure (CORRECTED):**
- **Quotas are SHARED POOL** across all Gemini models within same project
- **Gemini AI Clarification**: *"The free tier operates on a shared quota system, not per-model buckets"*
- Daily quotas reset at **midnight Pacific time**

**2. FAQs:**
- **Q: "gemini-2.5-flash-lite offers 1000 free RPD?"** 
  - **A: YES** - But shared across ALL Gemini models in your project
- **Q: "How is quota calculated for single API key?"**
  - **A: SHARED POOL** - All Gemini model calls count toward your project's daily limit
- **Q: "Remove gemini-2.5-flash from constants.ts?"**
  - **A: Keep priority order** - Use efficient models first to maximize quota usage

**3. Conservative Quota Strategy:**
- **Project daily limit**: ~1,000 requests/day (shared across all Gemini models)
- Set warning at **90% usage** (900 requests/day)
- Return `HTTP 429 Too Many Requests` with proper error message
- **Smart model fallback**: Use most efficient models first (Flash-Lite → Flash → etc.)

**4. Production Recommendations:**
- **Primary model**: gemini-2.5-flash-lite (most efficient for quota usage)
- **Fallback strategy**: Switch models for performance, not quota bypass
- **Total daily quota**: ~1,000 requests across ALL Gemini models
- **Cost impact**: ₹140/month → ₹0/month with proper quota management

### **🚀 Enhanced Implementation Plan with Caching**

#### **✅ Phase 1: Database Schema (COMPLETED)**
- ✅ ApiQuotaSchema model for persistent quota management (`/src/models/ApiQuotaSchema.ts`)
- ✅ Quota types definitions (`/src/types/quota.ts`)
- ✅ MongoDB compound index for performance (`{service: 1, date: 1}`)
- ✅ TTL auto-cleanup (30 days) using field-level `expires` pattern

#### **Phase 2: Core Services (Day 1-2)**  
- **TODO**: Create QuotaService class (`/src/services/QuotaService.ts`) for **shared quota pool** enforcement (~1,000 requests/day)
  - **Auto-creation logic**: `incrementCounter()` creates new daily records automatically when date changes
  - **Pacific timezone**: Uses `toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })` for date calculation
  - **No cron needed**: First API call of each day triggers automatic "reset" by creating new record
  - **Methods to implement**: `incrementCounter()`, `getCurrentCount()`, `getUsageHistory()`
- Enhanced AI response caching to minimize redundant API calls

#### **Phase 3: Caching Optimization (Day 2)**
**Problem**: Identical AI requests waste quota unnecessarily
**Solution**: Extend existing caching with expiration timing
```typescript
// Current: Basic content hash caching
const hash = generateSummarizationContentHash(content, language, style);

// Enhanced: Time-based cache expiration + quota-aware caching
const cacheOptions = {
    ttlHours: 24,           // Cache responses for 24 hours
    quotaThreshold: 0.8,    // Enable aggressive caching when 80% quota used
    contentSimilarity: 0.9  // Cache similar content (avoid near-duplicate AI calls)
};
```

**Benefits:**
- **Reduce API calls by 30-50%** for similar content
- **Smart cache expiration** based on content freshness needs  
- **Quota-aware caching** - more aggressive when approaching limits
- **Content similarity detection** - avoid processing near-duplicate articles

#### **Phase 4: Service Integration (Day 2-3)**
- Replace SummarizationService in-memory counters
- Replace NewsService quota logic  
- Integrate enhanced caching throughout AI pipeline

#### **Phase 5: Testing & Validation (Day 3-4)**
- Quota persistence testing across server restarts
- Cache effectiveness measurement
- Load testing with quota enforcement

## 🎯 **Bottom Line**

Your analysis is **spot-on**. This is a textbook example of why production applications need persistent quota management. The MongoDB approach is perfect for your learning goals - you'll understand quota management, database design, and cost control all in one solution.

**This isn't just a bug fix - it's a valuable learning experience in production-ready architecture!**