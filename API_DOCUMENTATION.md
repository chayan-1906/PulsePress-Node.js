# PulsePress API Documentation

> Complete API Reference for PulsePress News Platform

**Version**: 1.0.0
**Base URL**: `http://localhost:4000/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [News Endpoints](#2-news-endpoints)
3. [AI Features](#3-ai-features)
4. [User Preferences](#4-user-preferences)
5. [Bookmarks](#5-bookmarks)
6. [Reading History](#6-reading-history)
7. [Content Recommendations](#7-content-recommendations)
8. [Analytics](#8-analytics)
9. [User Strikes](#9-user-strikes)
10. [Health Monitoring](#10-health-monitoring)
11. [Error Codes](#11-error-codes)
12. [Rate Limits](#12-rate-limits)

---

## Quick Reference

| Method | Endpoint                     | Auth Required | Description                          |
|--------|------------------------------|---------------|--------------------------------------|
| POST   | `/auth/register`             | ❌             | Create new account                   |
| POST   | `/auth/login`                | ❌             | Email/password login                 |
| GET    | `/news/multi-source/enhance` | ❌             | Fetch enhanced news from all sources |
| POST   | `/ai/summarize`              | ✅             | Generate article summary             |
| GET    | `/recommendation`            | ✅             | Get personalized recommendations     |

---

## 1. Authentication

All authentication endpoints are under `/api/v1/auth`

### 1.1 Register New User

**POST** `/register`

Create a new user account with email and password.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Registration successful! Check your email to verify your account"
}
```

**Validation Rules:**

- Name: 2-50 characters
- Email: Valid format
- Password: Min 6 chars, 1 uppercase, 1 lowercase, 1 special character
- Passwords must match

---

### 1.2 Login

**POST** `/login`

Authenticate user and receive JWT tokens.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful 🎉",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**

- `404`: User not found
- `400`: User not verified
- `400`: Invalid credentials
- `400`: Account uses Google Sign-In (use Google authentication)
- `400`: Account uses Magic Link Sign-In (use magic link)

---

### 1.3 Reset Password

**POST** `/reset-password`

**Auth Required:** ✅

Reset user password (requires current password).

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

---

### 1.4 Refresh Access Token

**POST** `/refresh-token`

Get new access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Token has been refreshed 🎉",
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 1.5 Google OAuth Login

**GET** `/google`

Redirect to Google OAuth consent screen.

**Query Parameters:**

- `platform` (optional): `web` | `mobile` | `desktop` (default: `web`)

**Redirects to:** Google OAuth consent page

---

### 1.6 Google OAuth Callback

**GET** `/oauth2callback`

OAuth callback endpoint (handled automatically by Google).

---

### 1.7 Request Magic Link

**POST** `/magic-link`

Send passwordless login link via email.

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Magic link sent to john@example.com",
  "expiresIn": "15 minutes"
}
```

---

### 1.8 Verify Magic Link

**GET** `/verify-magic-link`

Verify magic link token (opens in browser).

**Query Parameters:**

- `token` (required): Magic link token from email

**Redirects to:** Success/error page with tokens in URL

---

### 1.9 Check Auth Status

**POST** `/check-auth-status`

Check if user session is valid.

**Request Body:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**

```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

### 1.10 Get User Profile

**GET** `/profile`

**Auth Required:** ✅

Get authenticated user's profile.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "authMethod": "email",
    "createdAt": "2025-01-20T10:00:00Z",
    "strikes": 0
  }
}
```

---

### 1.11 Update Profile

**PUT** `/profile`

**Auth Required:** ✅

Update user profile information.

**Request Body:**

```json
{
  "name": "John Smith"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john@example.com"
  }
}
```

---

### 1.12 Delete Account

**DELETE** `/profile`

**Auth Required:** ✅

Permanently delete user account.

**Response (200):**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## 2. News Endpoints

All news endpoints are under `/api/v1/news`

### 2.1 NewsAPI.org Top Headlines

**GET** `/newsapiorg/top-headlines`

Fetch breaking news and top headlines from NewsAPI.org.

**Query Parameters:**

- `country` (optional): 2-letter country code (e.g., `us`, `in`)
- `category` (optional): `business`, `entertainment`, `general`, `health`, `science`, `sports`, `technology`
- `sources` (optional): Comma-separated source IDs (e.g., `techcrunch,bbc-news`)
- `q` (optional): Search query
- `pageSize` (optional): Results per page, 1-100 (default: `20`)
- `page` (optional): Page number (default: `1`)

**Example:**

```
GET /newsapiorg/top-headlines?country=us&category=technology&pageSize=10
```

**Response (200):**

```json
{
  "success": true,
  "message": "Top headlines have been fetched 🎉",
  "topHeadlines": {
    "articles": [
      {
        "source": {
          "id": "techcrunch",
          "name": "TechCrunch"
        },
        "author": "Jane Smith",
        "title": "AI Breakthrough in Healthcare",
        "description": "Researchers announce...",
        "url": "https://techcrunch.com/...",
        "urlToImage": "https://...",
        "publishedAt": "2025-01-20T10:30:00Z",
        "content": "Full article text..."
      }
    ],
    "totalResults": 245
  }
}
```

---

### 2.2 NewsAPI.org Search Everything

**GET** `/newsapiorg/search`

Advanced search across all NewsAPI.org articles.

**Query Parameters:**

- `sources` (optional): Comma-separated source IDs
- `q` (optional): Search query
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `sortBy` (optional): `relevancy`, `popularity`, `publishedAt`
- `language` (optional): 2-letter language code
- `pageSize` (optional): Results per page
- `page` (optional): Page number

**Note:** Either `sources` or `q` parameter is required.

**Example:**

```
GET /newsapiorg/search?q=tesla&from=2025-01-01&sortBy=publishedAt
```

**Response (200):**

```json
{
  "success": true,
  "message": "Search results have been found 🎉",
  "searchResults": {
    "articles": [...],
    "totalResults": 156
  }
}
```

---

### 2.3 Guardian News Search

**GET** `/guardian/search`

Search articles from The Guardian.

**Query Parameters:**

- `q` (optional): Search query
- `section` (optional): Guardian section (e.g., `environment`, `technology`)
- `fromDate` (optional): Start date (YYYY-MM-DD)
- `toDate` (optional): End date (YYYY-MM-DD)
- `orderBy` (optional): `newest`, `oldest`, `relevance`
- `pageSize` (optional): Results per page
- `page` (optional): Page number

**Example:**

```
GET /guardian/search?q=climate%20change&section=environment&pageSize=10
```

**Response (200):**

```json
{
  "success": true,
  "message": "Guardian news articles have been found 🎉",
  "searchResults": {
    "articles": [...],
    "totalResults": 89
  }
}
```

---

### 2.4 New York Times Search

**GET** `/nytimes/search`

Search articles from The New York Times.

**Query Parameters:**

- `q` (optional): Search query
- `section` (optional): NYTimes section (see valid sections below)
- `sort` (optional): `newest`, `oldest`, `relevance`
- `fromDate` (optional): Start date (YYYY-MM-DD)
- `toDate` (optional): End date (YYYY-MM-DD)
- `pageSize` (optional): Results per page
- `page` (optional): Page number

**Valid NYTimes Sections:**
`arts`, `automobiles`, `books`, `business`, `fashion`, `food`, `health`, `home`, `insider`, `magazine`, `movies`, `nyregion`, `obituaries`, `opinion`, `politics`, `realestate`, `science`, `sports`,
`sundayreview`, `technology`, `theater`, `t-magazine`, `travel`, `upshot`, `us`, `world`

**Example:**

```
GET /nytimes/search?q=artificial%20intelligence&section=technology&sort=newest
```

**Response (200):**

```json
{
  "success": true,
  "message": "NYTimes news articles have been found 🎉",
  "searchResults": {
    "articles": [...],
    "totalResults": 45
  }
}
```

---

### 2.5 New York Times Top Stories

**GET** `/nytimes/top-stories`

Get top stories from The New York Times.

**Query Parameters:**

- `section` (optional): NYTimes section (default: `home`)

**Example:**

```
GET /nytimes/top-stories?section=technology
```

**Response (200):**

```json
{
  "success": true,
  "message": "NYTimes top stories have been found 🎉",
  "topStories": {
    "articles": [...],
    "totalResults": 25
  }
}
```

---

### 2.6 RSS Feeds

**GET** `/rss`

Fetch news from RSS feed sources.

**Query Parameters:**

- `sources` (optional): Comma-separated RSS source names (e.g., `prothom_alo,zeenews_bengali`)
- `language` (optional): Feed language filter (e.g., `bengali`, `hindi`)
- `pageSize` (optional): Results per page
- `page` (optional): Page number

**Example:**

```
GET /rss?sources=prothom_alo,zeenews_bengali&language=bengali&pageSize=12&page=2
```

**Response (200):**

```json
{
  "success": true,
  "message": "RSS feeds have been fetched 🎉",
  "rssFeeds": {
    "articles": [...],
    "totalResults": 78
  }
}
```

---

### 2.7 Explore Topic

**GET** `/explore/:topic`

**Auth Required:** ❌ (Optional - better results when authenticated)

Explore curated news by topic with intelligent query expansion.

**Path Parameters:**

- `topic` (required): Topic to explore (e.g., `technology`, `sports`, `business`)

**Example:**

```
GET /explore/technology
```

**Response (200):**

```json
{
  "success": true,
  "message": "Topic exploration results fetched 🎉",
  "topic": "technology",
  "articles": [...],
  "totalResults": 120,
  "metadata": {
    "icon": "💻",
    "description": "Latest technology news and updates"
  }
}
```

---

### 2.8 Multi-Source Enhanced News

**GET** `/multi-source/enhance`

**Auth Required:** ❌ (Optional - AI enhancements require auth)

**RECOMMENDED FOR HOME SCREEN** - Fetch news from multiple sources with AI enhancements.

**Query Parameters:**

- `q` (optional): Search query
- `category` (optional): News category
- `sources` (optional): Comma-separated source names
- `pageSize` (optional): Results per page (default: `10`)
- `page` (optional): Page number (default: `1`)

**Example:**

```
GET /multi-source/enhance?q=tesla&category=technology&sources=techcrunch&pageSize=10&page=1
```

**Response (200):**

```json
{
  "success": true,
  "message": "Articles fetched and enhancement started",
  "articles": [
    {
      "articleId": "abc123def456",
      "title": "AI Breakthrough in Healthcare",
      "description": "Researchers announce...",
      "url": "https://techcrunch.com/...",
      "urlToImage": "https://...",
      "source": "TechCrunch",
      "author": "Jane Smith",
      "publishedAt": "2025-01-20T10:30:00Z",
      "enhancements": {
        "processingStatus": "pending",
        "estimatedTime": "30 seconds"
      }
    }
  ],
  "totalResults": 245,
  "page": 1,
  "pageSize": 10
}
```

**Note:** Enhancements are processed asynchronously. Use the enhancement status endpoint to check completion.

---

### 2.9 Multi-Source Enhancement Status

**GET** `/multi-source/enhancement-status`

**Auth Required:** ❌ (Optional)

**FOR POLLING** - Check if article AI enhancements are complete.

**Query Parameters:**

- `articleIds` (required): Comma-separated article IDs

**Example:**

```
GET /multi-source/enhancement-status?articleIds=abc123,def456,ghi789
```

**Response (200):**

```json
{
  "success": true,
  "enhancements": [
    {
      "articleId": "abc123",
      "status": "completed",
      "summary": "Researchers announce breakthrough...",
      "keyPoints": [
        "AI model achieves 95% accuracy",
        "Clinical trials begin in Q2",
        "Partnership with major hospital"
      ],
      "tags": ["AI", "Healthcare", "Innovation"],
      "sentiment": {
        "type": "positive",
        "confidence": 0.89,
        "emoji": "😊",
        "color": "#4CAF50"
      },
      "readingTime": "5 minutes"
    },
    {
      "articleId": "def456",
      "status": "processing",
      "estimatedTime": "15 seconds"
    },
    {
      "articleId": "ghi789",
      "status": "failed",
      "error": "Content unavailable"
    }
  ]
}
```

---

### 2.10 Article Details Enhancement

**POST** `/article/enhance`

**Auth Required:** ❌ (Optional - better results when authenticated)

**FOR ARTICLE DETAILS SCREEN** - Get comprehensive AI enhancements for a specific article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "articleId": "abc123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Article enhancement completed 🎉",
  "article": {
    "articleId": "abc123",
    "title": "...",
    "content": "...",
    "summary": "...",
    "keyPoints": [...],
    "tags": [...],
    "sentiment": {...},
    "readingTime": "5 minutes",
    "complexity": {
      "level": "intermediate",
      "score": 6.5
    }
  }
}
```

---

### 2.11 Scrape Article Content

**POST** `/scrape`

Extract full article content from multiple URLs.

**Request Body:**

```json
{
  "urls": [
    "https://example.com/article1",
    "https://example.com/article2"
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Scraped 2 of 2 websites successfully 🎉",
  "totalResults": 2,
  "successful": 2,
  "failed": 0,
  "contents": [
    {
      "status": 200,
      "url": "https://example.com/article1",
      "title": "Article Title",
      "author": "John Doe",
      "content": "Full article text...",
      "excerpt": "Brief excerpt...",
      "publishedAt": "2025-01-20T10:30:00Z",
      "siteName": "Example News",
      "length": 1250,
      "byline": "By John Doe"
    },
    {
      "status": 200,
      "url": "https://example.com/article2",
      "title": "Another Article",
      "author": "Jane Smith",
      "content": "Full article text...",
      "excerpt": "Brief excerpt...",
      "publishedAt": "2025-01-20T11:00:00Z",
      "siteName": "Tech News",
      "length": 980,
      "byline": "By Jane Smith"
    }
  ]
}
```

**Note:** This endpoint accepts an array of URLs and returns an array of scraped articles. Each article in the response includes a `status` field indicating the scraping success (200 for success).

---

## 3. AI Features

All AI endpoints are under `/api/v1/ai`

**Auth Required:** ✅ (All AI endpoints require authentication)

**Strike System:** AI endpoints enforce a strike system for non-news content:

- 1 strike: Warning
- 2 strikes: 15-minute AI cooldown
- 3+ strikes: 2-hour AI block

---

### 3.1 Classify Content

**POST** `/classify`

Determine if content is news and classify category.

**Request Body:**

```json
{
  "text": "Article text content...",
  "url": "https://example.com/article"
}
```

**Note:** Provide either `text` or `url`, not both.

**Response (200):**

```json
{
  "success": true,
  "message": "Content has been classified successfully 🎉",
  "classification": {
    "category": "Technology",
    "subcategory": "Artificial Intelligence",
    "confidence": 0.92
  },
  "isNews": true
}
```

**Error Response (400 - Non-news content):**

```json
{
  "success": false,
  "errorCode": "NON_NEWS_CONTENT",
  "errorMsg": "Non-news content detected",
  "strikeCount": 1,
  "isBlocked": false,
  "classification": {
    "category": "Entertainment",
    "reason": "Promotional content"
  },
  "isNews": false
}
```

---

### 3.2 Summarize Article

**POST** `/summarize`

Generate AI-powered article summary.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched article content",
  "style": "concise",
  "language": "en"
}
```

**Parameters:**

- `url` (required): Article URL
- `content` (optional): Pre-scraped content (if not provided, will be scraped)
- `style` (optional): `concise`, `detailed`, `bullet-points` (default: `concise`)
- `language` (optional): Output language code (default: `en`)

**Response (200):**

```json
{
  "success": true,
  "message": "Article has been summarized 🎉",
  "summary": "Researchers at Stanford University announced a breakthrough in AI-powered medical diagnostics, achieving 95% accuracy in clinical trials...",
  "powered_by": "gemini-2.0-flash-exp"
}
```

**Rate Limit:** 30 requests per 5 minutes

---

### 3.3 Generate Tags

**POST** `/generate-tags`

Auto-generate relevant tags for article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content",
  "maxTags": 8
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Tags generated successfully 🎉",
  "tags": [
    { "name": "Artificial Intelligence", "relevance": 0.95 },
    { "name": "Healthcare", "relevance": 0.87 },
    { "name": "Innovation", "relevance": 0.72 },
    { "name": "Stanford University", "relevance": 0.68 }
  ],
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.4 Analyze Sentiment

**POST** `/sentiment`

Detect sentiment and emotion in article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Sentiment analysis completed 🎉",
  "sentiment": {
    "type": "positive",
    "confidence": 0.89,
    "emoji": "😊",
    "color": "#4CAF50",
    "score": 0.75
  },
  "emotions": {
    "joy": 0.75,
    "optimism": 0.68,
    "trust": 0.52,
    "fear": 0.12,
    "anger": 0.05
  },
  "powered_by": "gemini-2.0-flash-exp"
}
```

**Sentiment Types:**

- `positive`: Good news, optimistic tone
- `negative`: Bad news, pessimistic tone
- `neutral`: Balanced, factual reporting
- `mixed`: Contains both positive and negative elements

---

### 3.5 Extract Key Points

**POST** `/extract-key-points`

Extract main points from article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content",
  "maxPoints": 5
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Key points extracted successfully 🎉",
  "keyPoints": [
    "Stanford researchers develop new AI diagnostic tool",
    "Model achieves 95% accuracy in clinical tests",
    "Technology reduces diagnosis time by 60%",
    "Clinical trials begin in March 2025",
    "Partnership with Johns Hopkins Hospital announced"
  ],
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.6 Complexity Meter

**POST** `/complexity-meter`

Assess reading difficulty level.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Complexity analysis completed 🎉",
  "complexity": {
    "level": "intermediate",
    "score": 6.5,
    "readingAge": "13-15 years",
    "metrics": {
      "averageWordsPerSentence": 18.5,
      "syllablesPerWord": 1.8,
      "fleschReadingEase": 65.2,
      "fleschKincaidGrade": 8.3
    },
    "recommendation": "Suitable for high school readers"
  },
  "powered_by": "gemini-2.0-flash-exp"
}
```

**Complexity Levels:**

- `elementary`: Grade 1-6 (score 0-6)
- `intermediate`: Grade 7-12 (score 6-12)
- `advanced`: College level (score 12-16)
- `expert`: Graduate level (score 16+)

---

### 3.7 Generate Questions

**POST** `/generate-questions`

Create comprehension questions from article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content",
  "numQuestions": 5,
  "difficulty": "medium"
}
```

**Parameters:**

- `difficulty`: `easy`, `medium`, `hard`

**Response (200):**

```json
{
  "success": true,
  "message": "Questions generated successfully 🎉",
  "questions": [
    {
      "question": "What accuracy did the AI model achieve in clinical tests?",
      "type": "factual",
      "difficulty": "easy"
    },
    {
      "question": "When will clinical trials begin?",
      "type": "factual",
      "difficulty": "easy"
    },
    {
      "question": "How might this technology impact rural healthcare access?",
      "type": "analytical",
      "difficulty": "medium"
    }
  ],
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.8 Answer Question

**POST** `/answer-question`

Get AI-powered answer to question about article.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content",
  "question": "What is the main achievement described in this article?"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Question answered successfully 🎉",
  "answer": "The main achievement is the development of a new AI diagnostic tool that achieved 95% accuracy in clinical tests, reducing diagnosis time by 60%.",
  "confidence": 0.92,
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.9 Extract Locations

**POST** `/extract-locations`

Identify locations, organizations, and entities.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Geographic information extracted 🎉",
  "locations": [
    {
      "name": "Stanford, California",
      "type": "city",
      "country": "United States",
      "coordinates": { "lat": 37.4275, "lng": -122.1697 }
    }
  ],
  "organizations": ["Stanford University", "Johns Hopkins Hospital"],
  "people": ["Dr. Jane Smith", "Prof. Robert Chen"],
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.10 Social Media Caption

**POST** `/social-media-caption`

Create platform-specific social media captions.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content",
  "platform": "twitter",
  "style": "professional"
}
```

**Parameters:**

- `platform`: `twitter`, `facebook`, `linkedin`, `instagram`
- `style`: `professional`, `casual`, `enthusiastic`, `informative`

**Response (200):**

```json
{
  "success": true,
  "message": "Social media caption generated 🎉",
  "caption": "🚀 Breakthrough in AI healthcare! Stanford's new diagnostic tool achieves 95% accuracy. Clinical trials start Q1 2025. #AI #Healthcare #Innovation",
  "hashtags": ["#AI", "#Healthcare", "#Innovation", "#MedTech"],
  "characterCount": 147,
  "platformLimits": {
    "twitter": 280,
    "used": 147,
    "remaining": 133
  },
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

### 3.11 News Insights

**POST** `/news-insights`

Extract deeper implications, trends, and connections.

**Request Body:**

```json
{
  "url": "https://example.com/article",
  "content": "Optional: Pre-fetched content"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "News insights generated 🎉",
  "insights": {
    "mainInsight": "This breakthrough represents a significant shift in AI-powered healthcare diagnostics",
    "implications": [
      "Economic: Potential $10B market opportunity by 2030",
      "Social: Improved healthcare access in underserved areas",
      "Technical: New standard for AI diagnostic accuracy"
    ],
    "relatedTrends": ["AI in Healthcare", "Telemedicine Growth", "Precision Medicine"],
    "futureOutlook": "Experts predict widespread clinical adoption within 3-5 years",
    "keyStakeholders": ["Healthcare providers", "AI researchers", "Patients", "Insurance companies"]
  },
  "powered_by": "gemini-2.0-flash-exp"
}
```

---

## 4. User Preferences

All preference endpoints are under `/api/v1/preferences`

**Auth Required:** ✅

### 4.1 Get User Preferences

**GET** `/`

Retrieve current user preferences.

**Response (200):**

```json
{
  "success": true,
  "preferences": {
    "favoriteCategories": ["technology", "science"],
    "favoriteSources": ["techcrunch", "bbc-news"],
    "favoriteTopics": ["AI", "Climate Change"],
    "languages": ["en", "es"],
    "excludedSources": ["tabloid-news"],
    "notificationSettings": {
      "email": true,
      "push": false,
      "breakingNews": true
    }
  }
}
```

---

### 4.2 Update Preferences

**PUT** `/`

Update user preferences (replaces all preferences).

**Request Body:**

```json
{
  "favoriteCategories": ["technology", "business"],
  "favoriteSources": ["techcrunch", "wsj"],
  "favoriteTopics": ["AI", "Startups"],
  "languages": ["en"]
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "preferences": {
    "favoriteCategories": ["technology", "business"],
    "favoriteSources": ["techcrunch", "wsj"],
    "favoriteTopics": ["AI", "Startups"],
    "languages": ["en"]
  }
}
```

---

### 4.3 Reset Preferences

**PUT** `/reset`

Reset preferences to default values.

**Response (200):**

```json
{
  "success": true,
  "message": "Preferences reset to default",
  "preferences": {
    "favoriteCategories": [],
    "favoriteSources": [],
    "favoriteTopics": [],
    "languages": ["en"]
  }
}
```

---

## 5. Bookmarks

All bookmark endpoints are under `/api/v1/bookmark`

**Auth Required:** ✅

**Note:** This API uses a toggle pattern for bookmarks, not traditional CRUD operations.

### 5.1 Toggle Bookmark

**PUT** `/toggle`

Add or remove a bookmark (toggle).

**Request Body:**

```json
{
  "articleId": "abc123def456",
  "title": "AI Breakthrough in Healthcare",
  "url": "https://techcrunch.com/...",
  "source": "TechCrunch",
  "author": "Jane Smith",
  "publishedAt": "2025-01-20T10:30:00Z",
  "urlToImage": "https://...",
  "description": "Researchers announce..."
}
```

**Response (200 - Bookmark added):**

```json
{
  "success": true,
  "message": "Article bookmarked successfully",
  "isBookmarked": true,
  "bookmark": {
    "id": "507f1f77bcf86cd799439011",
    "articleId": "abc123def456",
    "savedAt": "2025-01-20T15:30:00Z"
  }
}
```

**Response (200 - Bookmark removed):**

```json
{
  "success": true,
  "message": "Bookmark removed successfully",
  "isBookmarked": false
}
```

---

### 5.2 Check Bookmark Status

**GET** `/status`

Check if article is bookmarked.

**Query Parameters:**

- `articleId` (required): Article ID to check

**Example:**

```
GET /status?articleId=abc123def456
```

**Response (200):**

```json
{
  "success": true,
  "isBookmarked": true,
  "bookmarkId": "507f1f77bcf86cd799439011"
}
```

---

### 5.3 Get All Bookmarks

**GET** `/`

Retrieve user's saved articles.

**Query Parameters:**

- `page` (optional): Page number (default: `1`)
- `limit` (optional): Results per page (default: `20`)
- `sortBy` (optional): `createdAt`, `title`, `source` (default: `createdAt`)
- `sortOrder` (optional): `asc`, `desc` (default: `desc`)

**Example:**

```
GET /?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Response (200):**

```json
{
  "success": true,
  "bookmarks": [
    {
      "id": "507f1f77bcf86cd799439011",
      "articleId": "abc123def456",
      "title": "AI Breakthrough in Healthcare",
      "url": "https://...",
      "source": "TechCrunch",
      "author": "Jane Smith",
      "publishedAt": "2025-01-20T10:30:00Z",
      "savedAt": "2025-01-20T15:30:00Z"
    }
  ],
  "totalBookmarks": 45,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

### 5.4 Get Bookmark Count

**GET** `/count`

Get total number of bookmarks.

**Response (200):**

```json
{
  "success": true,
  "count": 45
}
```

---

### 5.5 Search Bookmarks

**GET** `/search`

Search through saved articles.

**Query Parameters:**

- `q` (optional): Search query (searches in title and description)
- `sources` (optional): Comma-separated source names to filter
- `sortBy` (optional): `createdAt`, `title`, `readDuration`
- `sortOrder` (optional): `asc`, `desc`

**Example:**

```
GET /search?q=AI&sources=techcrunch,bbc-news&sortBy=createdAt&sortOrder=desc
```

**Response (200):**

```json
{
  "success": true,
  "bookmarks": [...],
  "totalResults": 12
}
```

---

## 6. Reading History

All reading history endpoints are under `/api/v1/reading-history`

**Auth Required:** ✅

### 6.1 Track Article Read

**POST** `/track`

Record that user started reading an article.

**Request Body:**

```json
{
  "articleId": "abc123def456",
  "title": "AI Breakthrough",
  "url": "https://...",
  "source": "TechCrunch",
  "author": "Jane Smith",
  "publishedAt": "2025-01-20T10:30:00Z",
  "urlToImage": "https://..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Reading activity tracked",
  "history": {
    "id": "507f1f77bcf86cd799439011",
    "articleId": "abc123def456",
    "readAt": "2025-01-20T16:00:00Z",
    "isCompleted": false
  }
}
```

---

### 6.2 Complete Article

**PUT** `/complete`

Mark article as fully read.

**Request Body:**

```json
{
  "articleId": "abc123def456",
  "timeSpent": 180,
  "percentRead": 100
}
```

**Parameters:**

- `timeSpent`: Seconds spent reading
- `percentRead`: 0-100 percentage

**Response (200):**

```json
{
  "success": true,
  "message": "Article marked as completed",
  "history": {
    "id": "507f1f77bcf86cd799439011",
    "articleId": "abc123def456",
    "isCompleted": true,
    "completedAt": "2025-01-20T16:05:00Z",
    "readDuration": 180
  }
}
```

---

### 6.3 Get Reading History

**GET** `/`

Retrieve user's reading history.

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Results per page (default: `20`)
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `sortBy` (optional): `readAt`, `readDuration`
- `sortOrder` (optional): `asc`, `desc`

**Response (200):**

```json
{
  "success": true,
  "history": [
    {
      "id": "507f1f77bcf86cd799439011",
      "articleId": "abc123",
      "title": "AI Breakthrough",
      "source": "TechCrunch",
      "readAt": "2025-01-20T16:00:00Z",
      "isCompleted": true,
      "readDuration": 180,
      "percentRead": 100
    }
  ],
  "totalArticles": 120,
  "page": 1,
  "limit": 20
}
```

---

### 6.4 Get Reading Stats

**GET** `/stats`

Get reading statistics and analytics.

**Response (200):**

```json
{
  "success": true,
  "stats": {
    "totalArticlesRead": 120,
    "totalTimeSpent": 36000,
    "averageTimePerArticle": 300,
    "articlesThisWeek": 15,
    "articlesThisMonth": 62,
    "mostReadCategory": "technology",
    "mostReadSource": "TechCrunch",
    "completionRate": 0.85,
    "readingStreak": 7
  }
}
```

---

### 6.5 Search Reading History

**GET** `/search`

Search through reading history.

**Query Parameters:**

- `q` (optional): Search query
- `sources` (optional): Comma-separated source names
- `sortBy` (optional): `readAt`, `readDuration`, `title`
- `sortOrder` (optional): `asc`, `desc`

**Example:**

```
GET /search?q=AI&sources=techcrunch&sortBy=readDuration&sortOrder=desc
```

**Response (200):**

```json
{
  "success": true,
  "history": [...],
  "totalResults": 23
}
```

---

### 6.6 Delete Reading History Entry

**DELETE** `/delete`

Remove specific article from reading history.

**Request Body:**

```json
{
  "articleId": "abc123def456"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Article removed from reading history"
}
```

---

### 6.7 Clear All Reading History

**DELETE** `/clear`

Remove all reading history.

**Response (200):**

```json
{
  "success": true,
  "message": "Reading history cleared successfully"
}
```

---

## 7. Content Recommendations

All recommendation endpoints are under `/api/v1/recommendation`

**Auth Required:** ✅

### 7.1 Get Personalized Recommendations

**GET** `/`

Get AI-powered article recommendations based on reading history and preferences.

**Query Parameters:**

- `limit` (optional): Number of articles (default: `20`, max: `50`)
- `excludeRead` (optional): `true` | `false` (default: `true`)

**Example:**

```
GET /?limit=20&excludeRead=true
```

**Response (200):**

```json
{
  "success": true,
  "message": "Recommendations generated successfully 🎉",
  "recommendations": [
    {
      "articleId": "xyz789",
      "title": "Future of AI in Medicine",
      "description": "...",
      "url": "https://...",
      "urlToImage": "https://...",
      "source": "Nature",
      "author": "Dr. Sarah Johnson",
      "publishedAt": "2025-01-20T10:00:00Z",
      "score": 0.94,
      "reason": "Matches your interest in AI and Healthcare",
      "matchedPreferences": ["AI", "Healthcare", "Technology"]
    }
  ],
  "totalRecommendations": 20,
  "algorithm": "hybrid-collaborative-content",
  "generatedAt": "2025-01-20T17:00:00Z"
}
```

**Score Explanation:**

- `0.9-1.0`: Highly relevant (perfect match with preferences)
- `0.7-0.9`: Relevant (good match)
- `0.5-0.7`: Somewhat relevant (partial match)

**Note:** Recommendations are cached for 30 minutes to improve performance.

---

## 8. Analytics

All analytics endpoints are under `/api/v1/analytics`

**Auth Required:** ❌ (Public analytics)

### 8.1 Get Source Analytics

**GET** `/source`

Get engagement analytics for news sources.

**Query Parameters:**

- `limit` (optional): Number of sources to return (default: `10`)
- `sortBy` (optional): `engagementScore`, `totalViews`, `avgReadTime` (default: `engagementScore`)
- `sortOrder` (optional): `asc`, `desc` (default: `desc`)

**Example:**

```
GET /source?limit=10&sortBy=engagementScore&sortOrder=desc
```

**Response (200):**

```json
{
  "success": true,
  "analytics": [
    {
      "source": "TechCrunch",
      "totalViews": 15420,
      "totalBookmarks": 3240,
      "totalReads": 12100,
      "averageReadTime": 285,
      "engagementScore": 0.89,
      "completionRate": 0.78
    }
  ],
  "totalSources": 45,
  "generatedAt": "2025-01-20T17:00:00Z"
}
```

**Engagement Score Calculation:**

```
engagementScore = (completionRate * 0.4) + (bookmarkRate * 0.3) + (timeSpentNormalized * 0.3)
```

---

### 8.2 Get Top Performing Sources

**GET** `/top-performer`

Get top performing news sources.

**Query Parameters:**

- `limit` (optional): Number of sources (default: `5`)
- `minViews` (optional): Minimum views required (default: `10`)

**Example:**

```
GET /top-performer?limit=5&minViews=100
```

**Response (200):**

```json
{
  "success": true,
  "topPerformers": [
    {
      "source": "TechCrunch",
      "rank": 1,
      "engagementScore": 0.92,
      "totalViews": 25400,
      "metrics": {
        "avgReadTime": 310,
        "completionRate": 0.85,
        "bookmarkRate": 0.21
      }
    }
  ]
}
```

---

## 9. User Strikes

All strike endpoints are under `/api/v1/strikes`

**Auth Required:** ✅

### 9.1 Get Strike Status

**GET** `/status`

Check current strike count and restrictions.

**Response (200):**

```json
{
  "success": true,
  "strikes": {
    "currentStrikes": 1,
    "maxStrikes": 3,
    "status": "warning",
    "restrictions": {
      "canUseAI": true,
      "aiCooldown": false,
      "blockedUntil": null
    },
    "lastViolation": {
      "date": "2025-01-19T10:00:00Z",
      "reason": "Non-news URL classification",
      "type": "warning"
    },
    "nextAutoRecovery": "2025-01-27T10:00:00Z"
  }
}
```

**Strike Levels:**

- **0 strikes**: Normal access to all features
- **1 strike**: Warning - can still use AI
- **2 strikes**: 15-minute AI cooldown
- **3+ strikes**: 2-hour AI block

**Auto-Recovery:**

- Strikes automatically reset after 7 days of no violations

---

### 9.2 Get Strike History

**GET** `/history`

View all past violations.

**Response (200):**

```json
{
  "success": true,
  "history": [
    {
      "id": "507f1f77bcf86cd799439011",
      "date": "2025-01-19T10:00:00Z",
      "reason": "Non-news URL classification",
      "type": "warning",
      "url": "https://example.com/promo-page",
      "classification": "Promotional content",
      "strikeNumber": 1,
      "autoResetAt": "2025-01-26T10:00:00Z"
    }
  ],
  "totalViolations": 3,
  "activeStrikes": 1
}
```

---

## 10. Health Monitoring

All health endpoints are under `/api/v1/health`

**Auth Required:** ❌

### 10.1 Overall System Health

**GET** `/`

Comprehensive system health check.

**Response (200):**

```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "timestamp": "2025-01-20T17:00:00Z",
    "uptime": 86400,
    "version": "1.0.0",
    "services": {
      "database": "healthy",
      "newsapi": "healthy",
      "guardian": "healthy",
      "nytimes": "healthy",
      "rss": "healthy",
      "ai": "healthy",
      "email": "healthy"
    }
  }
}
```

**Status Values:**

- `healthy`: Service operational
- `degraded`: Service slow but working
- `unhealthy`: Service failing
- `unknown`: Unable to determine status

---

### 10.2 Database Health

**GET** `/database`

Check database connection status.

**Response (200):**

```json
{
  "success": true,
  "service": "database",
  "status": "healthy",
  "responseTime": 12,
  "details": {
    "connected": true,
    "readyState": "connected",
    "host": "localhost",
    "database": "pulsepress"
  }
}
```

---

### 10.3 NewsAPI.org Health

**GET** `/news`

Check NewsAPI.org service status.

**Response (200):**

```json
{
  "success": true,
  "service": "newsapi.org",
  "status": "healthy",
  "responseTime": 245,
  "details": {
    "apiKeyValid": true,
    "rateLimitRemaining": 950,
    "rateLimitTotal": 1000
  }
}
```

---

### 10.4 Guardian API Health

**GET** `/guardian`

Check The Guardian API status.

**Response (200):**

```json
{
  "success": true,
  "service": "guardian",
  "status": "healthy",
  "responseTime": 189
}
```

---

### 10.5 New York Times API Health

**GET** `/nytimes`

Check NYTimes API status.

**Response (200):**

```json
{
  "success": true,
  "service": "nytimes",
  "status": "healthy",
  "responseTime": 234
}
```

---

### 10.6 RSS Feeds Health

**GET** `/rss`

Check RSS feed parser status.

**Response (200):**

```json
{
  "success": true,
  "service": "rss-feeds",
  "status": "healthy",
  "details": {
    "totalFeeds": 15,
    "workingFeeds": 15,
    "failedFeeds": 0
  }
}
```

---

### 10.7 Email Service Health

**GET** `/email`

Check email service (Gmail SMTP) status.

**Response (200):**

```json
{
  "success": true,
  "service": "email",
  "status": "healthy",
  "details": {
    "provider": "Gmail SMTP",
    "configured": true
  }
}
```

---

### 10.8 Web Scraping Health

**GET** `/webscraping`

Check web scraping service (Cheerio) status.

**Response (200):**

```json
{
  "success": true,
  "service": "webscraping",
  "status": "healthy",
  "details": {
    "library": "Cheerio",
    "version": "1.0.0"
  }
}
```

---

### 10.9 Google Services Health

**GET** `/google-service`

Check Google OAuth service status.

**Response (200):**

```json
{
  "success": true,
  "service": "google-oauth",
  "status": "healthy",
  "details": {
    "clientIdConfigured": true,
    "callbackUrlConfigured": true
  }
}
```

---

### 10.10 AI News Classification Health

**GET** `/ai-news-classification`

Check AI content classification service.

**Response (200):**

```json
{
  "success": true,
  "service": "ai-news-classification",
  "status": "healthy",
  "responseTime": 1240,
  "details": {
    "provider": "Google Gemini",
    "model": "gemini-2.0-flash-exp"
  }
}
```

---

### 10.11 AI Summarization Health

**GET** `/ai-summarization`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-summarization",
  "status": "healthy",
  "responseTime": 1580
}
```

---

### 10.12 AI Tag Generation Health

**GET** `/ai-tag-generation`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-tag-generation",
  "status": "healthy",
  "responseTime": 1120
}
```

---

### 10.13 AI Sentiment Analysis Health

**GET** `/ai-sentiment-analysis`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-sentiment-analysis",
  "status": "healthy",
  "responseTime": 980
}
```

---

### 10.14 AI Key Points Extraction Health

**GET** `/ai-key-points-extraction`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-key-points-extraction",
  "status": "healthy",
  "responseTime": 1350
}
```

---

### 10.15 AI Complexity Meter Health

**GET** `/ai-complexity-meter`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-complexity-meter",
  "status": "healthy",
  "responseTime": 1180
}
```

---

### 10.16 AI Question & Answer Health

**GET** `/ai-question-answer`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-question-answer",
  "status": "healthy",
  "responseTime": 1420
}
```

---

### 10.17 AI Geographic Extraction Health

**GET** `/ai-geographic-extraction`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-geographic-extraction",
  "status": "healthy",
  "responseTime": 1290
}
```

---

### 10.18 AI Social Media Caption Health

**GET** `/ai-social-media-caption`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-social-media-caption",
  "status": "healthy",
  "responseTime": 1050
}
```

---

### 10.19 AI News Insights Health

**GET** `/ai-news-insights`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-news-insights",
  "status": "healthy",
  "responseTime": 1680
}
```

---

### 10.20 AI Article Enhancement Health

**GET** `/ai-article-enhancement`

**Response (200):**

```json
{
  "success": true,
  "service": "ai-article-enhancement",
  "status": "healthy",
  "responseTime": 2340,
  "details": {
    "components": {
      "summarization": "healthy",
      "tags": "healthy",
      "sentiment": "healthy",
      "keyPoints": "healthy"
    }
  }
}
```

---

### 10.21 HuggingFace AI Health

**GET** `/huggingface-ai`

**Response (200):**

```json
{
  "success": true,
  "service": "huggingface-ai",
  "status": "healthy",
  "responseTime": 890,
  "details": {
    "provider": "HuggingFace Inference API",
    "tokenConfigured": true
  }
}
```

---

## 11. Error Codes

### Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "errorCode": "AUTH_001",
  "errorMsg": "Invalid credentials"
}
```

### Error Code Categories

**Authentication (AUTH_xxx)**

- `MISSING_name`: Name field is required
- `MISSING_email`: Email field is required
- `MISSING_password`: Password field is required
- `MISSING_confirm_password`: Confirm password field is required
- `INVALID_password`: Password doesn't meet requirements
- `INVALID_credentials`: Email or password incorrect
- `PASSWORD_MISMATCH`: Passwords don't match
- `ALREADY_REGISTERED`: Email already in use
- `NOT_FOUND_user`: User account not found
- `USER_NOT_VERIFIED`: Email not verified
- `GOOGLE_OAUTH_USER`: Account uses Google Sign-In
- `MAGIC_LINK_USER`: Account uses Magic Link Sign-In
- `TOKEN_EXPIRED`: JWT token expired
- `INVALID_TOKEN`: JWT token invalid

**News (NEWS_xxx)**

- `INVALID_nytimes_section`: Invalid NYTimes section
- `MISSING_SEARCH_PARAMS`: Required search parameters missing
- `SCRAPING_FAILED`: Unable to scrape article content
- `ARTICLE_NOT_FOUND`: Article not found

**AI (AI_xxx)**

- `NON_NEWS_CONTENT`: Content is not news-related (triggers strike)
- `USER_BLOCKED`: User temporarily blocked from AI features
- `USER_BLOCKED_FROM_AI_FEATURES`: User blocked due to strikes
- `TEXT_OR_URL_REQUIRED`: Must provide text or URL
- `TEXT_AND_URL_CONFLICT`: Cannot provide both text and URL
- `CONTENT_REQUIRED`: Content is required for processing
- `CLASSIFICATION_FAILED`: AI classification failed
- `SUMMARIZATION_FAILED`: AI summarization failed
- `GEMINI_DAILY_LIMIT_REACHED`: Gemini API quota exceeded
- `MISSING_url`: URL parameter required
- `INVALID_style`: Invalid summarization style

**Database (DB_xxx)**

- `DB_CONNECTION_FAILED`: Database connection error
- `DB_QUERY_ERROR`: Database query failed

**Validation (VAL_xxx)**

- `MISSING_<field>`: Required field missing
- `INVALID_<field>`: Field format invalid
- `NOT_FOUND_<resource>`: Resource not found

---

## 12. Rate Limits

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1642694400
```

### Endpoint Rate Limits

| Category             | Window     | Max Requests |
|----------------------|------------|--------------|
| **AI Features**      | 5 minutes  | 30           |
| **News Scraping**    | 15 minutes | 50           |
| **Authentication**   | 15 minutes | 10           |
| **Bookmarks**        | 5 minutes  | 20           |
| **Reading History**  | 5 minutes  | 30           |
| **User Preferences** | 15 minutes | 10           |

### Rate Limit Exceeded Response

**Status: 429 Too Many Requests**

```json
{
  "success": false,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "errorMsg": "Too many requests. Try again in 180 seconds",
  "retryAfter": 180
}
```

---

## Additional Notes

### Authentication Header Format

All protected endpoints require:

```
Authorization: Bearer <access_token>
```

### Date Formats

All dates use ISO 8601 format:

```
2025-01-20T10:30:00Z
```

### Pagination

Paginated endpoints support:

- `page`: Page number (starts at 1)
- `limit` / `pageSize`: Results per page
- Default page size: 20
- Maximum page size: 100

### Language Codes

Supported languages (ISO 639-1):

- `en`: English
- `es`: Spanish
- `fr`: French
- `de`: German
- `hi`: Hindi
- `bn`: Bengali

### News Categories

Supported categories:

- `general`
- `business`
- `entertainment`
- `health`
- `science`
- `sports`
- `technology`

---

## Support

For API support or bug reports:

- **Email**: padmanabhadas9647@gmail.com
- **GitHub Issues**: https://github.com/chayan-1906/PulsePress-Node.js/issues
- **Documentation**: See README.md
