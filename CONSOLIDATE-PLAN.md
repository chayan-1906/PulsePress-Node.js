# 🔄 Cache Schema Consolidation - Implementation Plan

## ✅ Phase 1 Complete (90%)

- ✅ Unified `CachedArticleEnhancement` schema with all enhancement types
- ✅ Consolidated cache helpers in `cacheHelpers.ts` with proper interfaces
- ✅ `/multi-source/enhance` caches basic enhancements to unified schema
- ✅ Proper TypeScript interfaces and single export pattern
- ✅ **NEW:** Nested Map storage for summary/caption variations
- ✅ **NEW:** Style-aware cache functions with proper interfaces

## ✅ Critical Issue 1: RESOLVED - Style-Specific Hash Collision

**Problem SOLVED:** Single `contentHash` per article, variations stored in nested Maps
```typescript
// OLD Approach: hash("article content" + style + language) → multiple records
// NEW Approach: hash("article content") → single record with nested variations

summaries: Map<"standard+en", { content, style, language, createdAt }>
socialMediaCaptions: Map<"professional+twitter", { content, style, platform, createdAt }>
```

**Implementation:**

- ✅ Single `contentHash` per article content
- ✅ Nested Maps for `summaries` and `socialMediaCaptions`
- ✅ Composite keys: `"${style}+${language}"` and `"${style}+${platform}"`
- ✅ Helper functions: `saveSummaryVariation()`, `getCachedSummaryVariation()`, etc.

## 🚨 Remaining Critical Issues

### Issue 2: Processing Status Logic Bug

**Problem:** `/multi-source/enhance` status stuck on "processing"
**Investigation needed:** Status calculation in `getProcessingStatus()`

### Issue 3: Quota Wastage Bug - ALL AI Services

**Problem:** Quota reserved BEFORE cache check → wasting quota on cache hits
**Scope:** 7 out of 8 AI services affected (87.5% of services)

**Affected Services:**

- ❌ SummarizationService (reserves quota → then checks cache)
- ❌ TagGenerationService
- ❌ SentimentAnalysisService
- ❌ KeyPointsExtractionService
- ❌ ComplexityMeterService
- ❌ GeographicExtractionService
- ❌ SocialMediaCaptionService
- ❌ NewsInsightsService
- ✅ QuestionAnswerService (CORRECT: checks cache → then reserves quota)

**Current Problematic Flow:**

```
1. Auth & validation
2. Content classification
3. ❌ QUOTA RESERVATION (wastes quota even on cache hits!)
4. Cache check
5. AI call (if cache miss)
```

**Required Fix (follow QuestionAnswerService pattern):**

```
1. Auth & validation
2. Content classification
3. ✅ CACHE CHECK FIRST
4. Quota reservation (only if cache miss)
5. AI call
```

**Impact:** Every cached request wastes 1 quota point across all AI services
**Priority:** HIGH - significant cost optimization opportunity

## 📋 Phase 2: Complete Integration (20-30%)

### 2.1 ~~Fix Hash Generation Strategy~~ ✅ COMPLETED

~~Context-aware hashing~~ → **REPLACED with nested Map approach**

- ✅ Single content hash per article
- ✅ Variations stored in nested Maps with composite keys

### 2.2 Debug Processing Status Logic

- Check status calculation conditions in `getProcessingStatus()`
- Verify cache hit detection logic
- Fix completion status updates to mark as "complete"

### 2.3 Integration & Testing

- ✅ Integrate new cache functions into existing APIs
- ✅ Update summary/caption generation to use new cache structure
- Test progressive enhancement detection

## 📋 Phase 3: Schema Migration (20-30%)

### 3.1 Remove Old Schemas

- Delete `CachedSummarySchema` and `CachedQuestionAnswerSchema`
- Update all imports across codebase
- Remove old cache functions

### 3.2 Advanced Enhancement Support

- Cache lookup for summary/Q&A/insights
- Progressive enhancement for `/article-details` API
- Style-specific caching for social media captions

## 🎯 Success Criteria

- ✅ Basic enhancements cached correctly (Phase 1)
- ✅ Different summary styles cache separately (Phase 2)
- 🔧 Processing status updates to "complete" properly (Phase 2)
- ⏳ Old schemas removed, zero migration needed (Phase 3)
- ⏳ Ready for advanced enhancement APIs (Phase 3)