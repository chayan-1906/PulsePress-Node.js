# Cache Schema Consolidation Plan

## Objective

Replace multiple AI enhancement cache schemas with a single unified `CachedArticleEnhancement` schema that stores ALL AI enhancements for articles.

## Current State

### Existing Schemas to Consolidate:

- `CachedSummarySchema` stores summaries with style/language
- `CachedQuestionAnswerSchema` stores questions/answers
- Future: All other AI enhancements need caching

### Current Enhancement Types:

**Basic (from `/multi-source/enhance`):**

- `classification` - News classification
- `tags` - Smart tags
- `sentiment` - Sentiment analysis
- `keyPoints` - Key points extraction
- `complexityMeter` - Reading complexity
- `locations` - Geographic locations

**Advanced (future `/article-details` API):**

- `summary` - Article summaries (with style/language)
- `social-media-caption` - Social media captions (with style)
- `questions` - Generated questions
- `answers` - Q&A responses
- `newsInsights` - News insights analysis

## Implementation Steps

### Phase 1: Create Unified Schema

- [ ] Create new `CachedArticleEnhancementSchema.ts`
- [ ] Design flexible schema to handle all enhancement types
- [ ] Maintain `contentHash` as primary identifier
- [ ] Use TTL expiration (30 days)

### Phase 2: Update Services

- [ ] Create new `articleEnhancementCacheHelpers.ts`
- [ ] Update `ArticleEnhancementService.ts` to use new cache
- [ ] Migrate cache logic from existing helpers

### Phase 3: Data Migration

- [ ] Create migration script for existing cached data
- [ ] Migrate `CachedSummary` new schema
- [ ] Migrate `CachedQuestionAnswer` new schema

### Phase 4: Cleanup

- [ ] Remove old schemas and models
- [ ] Remove old cache helpers
- [ ] Update imports across codebase

## Proposed Schema Structure

```typescript
interface ICachedArticleEnhancement {
    contentHash: string;           // Unique identifier

    // Basic enhancements (from /multi-source/enhance)
    tags?: string[];
    sentiment?: {
        type: string;
        confidence: number;
        emoji: string;
        color: string;
    };
    keyPoints?: string[];
    complexityMeter?: {
        level: 'easy' | 'medium' | 'hard';
        reasoning: string;
    };
    locations?: string[];

    // Advanced enhancements (from future /article-details)
    summary?: {
        content: string;
        style: TSummarizationStyle;
        language: string;
    };
    socialMediaCaption?: {
        content: string;
        style: TSocialMediaCaptionStyle;
    };
    questions?: string[];
    answers?: Map<string, string>;
    newsInsights?: {
        keyThemes: string[];
        impactAssessment: object;
        // ... other insights
    };

    // Metadata
    createdAt: Date;
    expiresAt: Date;
}
```

## API Integration Flow

### Current `/multi-source/enhance`:

1. Generate basic enhancements (tags, sentiment, etc.)
2. Cache basic enhancements in unified schema
3. Return enhanced articles

### Future `/article-details`:

1. Check cache for advanced enhancements
2. If missing, generate summary/Q&A/insights
3. Update existing cache record with new enhancements
4. Return complete article details

## Benefits

- **Single source of truth** for all AI enhancements
- **Progressive enhancement** - cache grows with usage
- **Reduced complexity** - one schema, one set of helpers
- **Better performance** - no multiple cache lookups
- **Easier maintenance** - consolidated cache logic

## Success Criteria

- [ ] All existing functionality preserved
- [ ] New schema handles all enhancement types
- [ ] Cache hit rates maintained/improved
- [ ] Clean migration with zero data loss
- [ ] Ready for future `/article-details` implementation