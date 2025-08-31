**REFACTOR: PRINTING CONSOLE STATEMENTS (console.log, console.debug, console.warn, console.error, console.time) —**

**🎮 CONTROLLERS (API Request Layer):**

```tsx
// ✅ Function Start - Always use console.info with bgBlue.white.bold
console.info('Controller: registerUserController started'.bgBlue.white.bold);

// ✅ Success Results - Use console.log with bgGreen.bold
console.log('User registered successfully:'.bgGreen.bold, {userId: user.id});

// ✅ Client Errors (400s) - Use console.warn with yellow
console.warn('Client Error: Missing email parameter'.yellow);

// ✅ Server Errors (500s) - Use console.error with red.bold
console.error('Controller Error: registerUserController failed:'.red.bold, error);
```

**🔧 SERVICES (Business Logic Layer):**

```tsx
// ✅ Function Start - Use console.log with cyan.italic
console.log('Service: AuthService.getUserByEmail called'.cyan.italic);

// ✅ Important Operations - Use console.log with cyan
console.log('Database: User found in cache'.cyan, {email});

// ✅ Service Errors - Use console.error with red.bold
console.error('Service Error: Database connection failed:'.red.bold, error);

// ✅ External API Calls - Use console.log with magenta
console.log('External API: Calling NewsAPI endpoint'.magenta, url);
```

**🐛 DEBUG LOGGING (Development Details):**

```tsx
// ✅ Use console.debug for detailed tracing (can be filtered out in production) with gray
console.debug('Debug: Query parameters validated:'.gray, {country, category});
console.debug('Debug: Cache lookup result:'.gray, cacheResult);
console.debug('Debug: Processing 150 articles from RSS feed'.gray);
```

✅ Performance tracking - Use console.time/timeEnd with cyan:

```tsx
console.time('Performance: RSS_FETCH_TIME'.cyan);
console.timeEnd('Performance: RSS_FETCH_TIME'.cyan);
```

**⚠️ WARNINGS & CONFIGURATIONS:**

```tsx
// ✅ Config Issues - Use console.warn with yellow.italic
console.warn('Config Warning: Guardian API key missing'.yellow.italic);

// ✅ Fallback Behavior - Use console.warn with yellow
console.warn('Fallback: Using cached data due to API timeout'.yellow);

// ✅ Rate Limiting - Use console.warn with yellow
console.warn('Rate Limit: NewsAPI daily quota reached'.yellow);
```

**🎉 SUCCESS & COMPLETION:**

```tsx
// ✅ Major Success - Use console.log with bgGreen.bold
console.log('SUCCESS: Article summarization completed'.bgGreen.bold);

// ✅ Background Tasks - Use console.log with blue
console.log('Background: Daily API counter reset'.blue);
```

**📋 QUICK REFERENCE CHEAT SHEET:**

| **Scenario** | **Method** | **Color** | **Example** |
| --- | --- | --- | --- |
| **Controller start** | console.info | bgBlue.white.bold | 'Controller: loginController started’ |
| **Service start** | console.log | cyan.italic | 'Service: NewsService.fetchNews called’ |
| **Success operations** | console.log | bgGreen.bold | 'Database: User created successfully’ |
| **Client errors (400s)** | console.warn | yellow | Client Error: Invalid email format’ |
| **Server errors (500s)** | console.error | red.bold | 'Service Error: Database timeout’ |
| **Config issues** | console.warn | yellow.italic | 'Config Warning: API key missing’ |
| **Debug details** | console.debug | gray | 'Debug: Processing 50 articles’ |
| **Performance** | console.time | cyan | 'Performance: API_CALL_TIME’ |
| **External APIs** | console.log | magenta | 'External API: Calling Guardian endpoint’ |
| Background tasks | console.log | blue |  |

**When to Use console.debug():**

```tsx
Essential Debug Cases:

// ✅ 1. Loop/Batch Processing Details
console.debug('Debug: Processing article 25/100:'.gray, article.title);

// ✅ 2. Data Transformation Steps  
console.debug('Debug: Converting Guardian format to internal format'.gray);

// ✅ 3. Cache Operations
console.debug('Debug: Cache hit for key:'.gray, cacheKey);
console.debug('Debug: Cache miss, fetching from API'.gray);

// ✅ 4. Validation Results
console.debug('Debug: Email validation passed:'.gray, email);

// ✅ 5. Algorithm Details
console.debug('Debug: Fuse.js found 12 matches with threshold 0.4'.gray);

// ✅ 6. Request Processing Steps
console.debug('Debug: Extracted 5 query parameters from request'.gray);
```