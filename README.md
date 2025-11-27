# 🌟 PulsePress — AI-Powered News Aggregation Platform

> AI-Powered News Aggregation Platform with 11 Intelligent Features

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/chayan-1906/PulsePress-Node.js)
[![Node.js](https://img.shields.io/badge/node.js-18.x+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-8.16.5-47A248.svg)](https://www.mongodb.com/)
[![AI Features](https://img.shields.io/badge/AI_Features-11-purple.svg)](https://github.com/chayan-1906/PulsePress-Node.js#-ai-powered-features)
[![Multi Language](https://img.shields.io/badge/Multi_Language-Supported-orange.svg)]()
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5-4285F4.svg)](https://ai.google/)
[![Express](https://img.shields.io/badge/Express-5.1.0-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

PulsePress is a production-ready backend API that aggregates news from 70+ sources (NewsAPI, The Guardian, NY Times, and 130+ RSS feeds) and enhances articles with AI-powered features including
summarization, sentiment analysis, tag generation, and personalized recommendations.

---

## ✨ Key Features

## 🤖 AI-Powered Features

### 1. **Smart Summarization** 📝

AI-generated concise summaries using Google Gemini 2.5 models with intelligent content truncation and context preservation.

### 2. **Sentiment Analysis** 😊

Real-time sentiment detection with confidence scores, emotional indicators, and color-coded visualization.

### 3. **Key Points Extraction** 🎯

Automatic extraction of 3-5 crucial points from articles for quick comprehension.

### 4. **Reading Complexity Meter** 📊

AI-powered complexity assessment analyzing vocabulary, sentence structure, and technical terminology.

### 5. **Smart Tag Generation** 🏷️

Intelligent categorization with contextual tags for improved discoverability and navigation.

### 6. **Geographic Entity Recognition** 🌍

Location extraction and mapping for geographical context awareness.

### 7. **Social Media Captions** 📱

AI-generated platform-specific captions optimized for Twitter, LinkedIn, and Facebook engagement.

### 8. **Interactive Q&A System** ❓

Intelligent question generation for deeper engagement and context-aware question answering using article content.

### 9. **News Insights Analysis** 🔍

Advanced contextual analysis, including stakeholder impact, timeline connections, and theme identification.

### 10. **Multi-language Translation** 🌐

Google Translate integration supporting 100+ languages for global accessibility.

### 11. **Content Classification** 🗂️

Non-news content detection with an intelligent strike system for quality control.

### 📰 Multi-Source Aggregation

- **70+ News Sources**: NewsAPI.org, The Guardian, NY Times, 130+ RSS feeds
- **Multi-Language Support**: English, Bengali, Hindi content + 26 AI languages
- **Smart Deduplication**: URL-based article deduplication
- **Real-Time Processing**: Background AI enhancement pipeline

### 🎯 Personalization Engine

- **Reading History Tracking**: Engagement analytics
- **Custom Feeds**: User-defined categories and sources
- **Bookmark Management**: Save and organize articles

### 🔒 Enterprise-Grade Security

- **3 Authentication Methods**: Email/Password, Google OAuth 2.0, Magic Links
- **JWT Token Management**: Access + Refresh token rotation
- **Strike System**: Abuse prevention with auto-recovery
- **Rate Limiting**: Endpoint-specific quotas
- **API Quota Management**: Per-user usage tracking

### 📊 Analytics & Monitoring

- **21 Health Checks**: Database, AI services, external APIs
- **Source Performance**: Quality scoring and tracking
- **User Engagement Metrics**: Reading patterns and preferences
- **Real-Time Monitoring**: System health dashboard

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              CLIENT APPLICATIONS                     │
│        (Web, Mobile, Desktop, etc.)                  │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP/REST
                    ▼
┌─────────────────────────────────────────────────────┐
│           EXPRESS API SERVER (PORT 4000)             │
├─────────────────────────────────────────────────────┤
│  • CORS & Security Middleware                        │
│  • JWT Authentication                                │
│  • Rate Limiting                                     │
│  • Request Logging                                   │
└───────────┬────────────┬────────────┬───────────────┘
            │            │            │
      ┌─────▼────┐ ┌────▼────┐ ┌────▼─────┐
      │   News   │ │   AI    │ │   Auth   │
      │ Services │ │Services │ │ Services │
      └─────┬────┘ └────┬────┘ └────┬─────┘
            │           │           │
      ┌─────▼───────────▼───────────▼─────┐
      │         EXTERNAL SERVICES          │
      │  • NewsAPI, Guardian, NYTimes      │
      │  • 130+ RSS Feeds                  │
      │  • Google Gemini AI (3 models)     │
      │  • Google Translate API            │
      └────────────────┬───────────────────┘
                       │
                 ┌─────▼─────┐
                 │  MongoDB  │
                 │ Database  │
                 └───────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **MongoDB** 8.16.5+
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/chayan-1906/PulsePress-Node.js.git
cd PulsePress-Node.js
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Environment Variables](#-environment-variables))

4. **Start the server**

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

Server runs at `http://localhost:4000`

---

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

### Core Configuration

```env
# Server
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/pulsepress
# Or MongoDB Atlas: mongodb+srv://<username>:<password>@cluster.mongodb.net/pulsepress
```

### Authentication

```env
# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/auth/google/callback
```

### News API Keys

```env
# NewsAPI.org (https://newsapi.org)
NEWS_API_KEY=your_newsapi_key

# The Guardian (https://open-platform.theguardian.com)
THE_GUARDIAN_API_KEY=your_guardian_key

# NY Times (https://developer.nytimes.com)
NY_TIMES_API_KEY=your_nytimes_key
```

### AI Services

```env
# Google Gemini AI (https://ai.google.dev)
GEMINI_API_KEY=your_gemini_api_key

# Google Cloud Translate (https://cloud.google.com/translate)
GOOGLE_TRANSLATE_API_KEY=your_translate_key

# HuggingFace (Optional - https://huggingface.co)
HUGGINGFACE_API_KEY=your_huggingface_key
```

### Email (Magic Links)

```env
# SMTP Configuration (e.g., Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@pulsepress.com
```

### Rate Limiting (Optional - Defaults Provided)

```env
# AI Features
AI_WINDOW_MS=300000        # 5 minutes
AI_MAX_REQUESTS=30

# News Scraping
NEWS_SCRAPING_WINDOW_MS=900000  # 15 minutes
NEWS_SCRAPING_MAX_REQUESTS=50
```

> **Note**: See `.env.example` for complete configuration options

---

## 📚 API Documentation

Complete API documentation with all 75 endpoints is available in **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

### Quick API Overview

| Category            | Endpoints | Description                                        |
|---------------------|-----------|----------------------------------------------------|
| **Authentication**  | 10        | Register, login, OAuth, magic links, token refresh |
| **News**            | 15        | Multi-source fetch, search, enhanced articles      |
| **AI Features**     | 11        | Summarization, sentiment, tags, insights, Q&A      |
| **Personalization** | 8         | Preferences, recommendations, reading history      |
| **Bookmarks**       | 5         | Save, organize, and manage articles                |
| **Analytics**       | 6         | User metrics, source performance, engagement       |
| **Health**          | 21        | System monitoring and diagnostics                  |

### Example: Fetch Enhanced News

**Request:**

```bash
GET /api/v1/news/multisource/enhanced?q=technology&pageSize=10
Authorization: Bearer <your_jwt_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Articles fetched and enhancement started",
  "data": {
    "articles": [
      {
        "articleId": "abc123...",
        "title": "AI Breakthrough in Healthcare",
        "url": "https://...",
        "source": "TechCrunch",
        "publishedAt": "2025-01-20T10:30:00Z",
        "enhancements": {
          "processingStatus": "completed",
          "summary": "...",
          "sentiment": {
            "type": "positive",
            "confidence": 0.89,
            "emoji": "😊"
          },
          "tags": ["AI", "Healthcare", "Innovation"],
          "readingTime": "5 minutes"
        }
      }
    ],
    "totalResults": 150,
    "page": 1,
    "pageSize": 10
  }
}
```

---

## 🗂️ Project Structure

```
pulsepress/
├── src/
│   ├── server.ts                  # Application entry point
│   ├── config/                    # Configuration files
│   │   ├── config.ts              # Environment variables
│   │   └── connectDB.ts           # MongoDB connection
│   ├── controllers/               # Request handlers (10 controllers)
│   │   ├── NewsController.ts
│   │   ├── AIController.ts
│   │   ├── AuthController.ts
│   │   └── ...
│   ├── services/                  # Business logic (25 services)
│   │   ├── NewsService.ts
│   │   ├── ArticleEnhancementService.ts
│   │   ├── ContentRecommendationService.ts
│   │   └── ...
│   ├── models/                    # MongoDB schemas (10 models)
│   │   ├── UserSchema.ts
│   │   ├── ArticleEnhancementSchema.ts
│   │   ├── BookmarkSchema.ts
│   │   └── ...
│   ├── routes/                    # API routes
│   ├── middlewares/               # Auth, rate limiting
│   ├── types/                     # TypeScript interfaces
│   └── utils/                     # Helper functions
├── .env.example                   # Environment template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

---

## 🛠️ Tech Stack

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express 5.1.0
- **Language**: TypeScript 5.8.3
- **Database**: MongoDB 8.16.5 (Mongoose ODM)

### AI

- **Google Gemini AI**: 2.5 Flash Preview, 2.0 Flash, 1.5 Flash
- **Google Translate API**: Multi-language support
- **HuggingFace Inference**: Backup AI models
- **Fuse.js**: Fuzzy search

### News Sources

- **NewsAPI.org**: Global news headlines
- **The Guardian**: Premium journalism
- **NY Times**: Quality news archives
- **RSS Feeds**: 130+ real-time feeds (English, Bengali, Hindi)

### Security & Auth

- **JWT**: Token-based authentication
- **bcryptjs**: Password hashing
- **Google OAuth 2.0**: Social login
- **express-rate-limit**: API protection

### Utilities

- **Axios**: HTTP client
- **Cheerio**: HTML parsing
- **JSDOM + Readability**: Article extraction
- **node-cron**: Scheduled tasks
- **Nodemailer**: Email service

---

## 📦 NPM Scripts

```bash
# Development
npm run dev          # Start with hot reload (nodemon)

# Production
npm run build        # Compile TypeScript to JavaScript
npm start            # Run compiled code
```

---

## 🔐 Authentication Flow

### 1. Email/Password Registration

```
POST /api/v1/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

### 2. Login & Receive Tokens

```
POST /api/v1/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { ... }
}
```

### 3. Use Access Token

```
GET /api/v1/news/multisource
Authorization: Bearer eyJhbGc...
```

### 4. Refresh Expired Token

```
POST /api/v1/auth/refresh
{
  "refreshToken": "eyJhbGc..."
}
```

---

## 🎯 Key Features in Detail

### AI Enhancement Pipeline

1. **Article Fetch**: Retrieve from multiple sources
2. **Initial Processing**: Return basic data immediately
3. **Background Enhancement**: Queue AI processing
4. **Status Polling**: Client checks enhancement status
5. **Cached Results**: Serve enhanced data from MongoDB

### Strike System

Protects AI features from abuse:

- **Warning (1 strike)**: Alert message
- **Cooldown (2 strikes)**: 15-minute AI block
- **Temporary Ban (3 strikes)**: 2-hour AI block
- **Auto-Recovery**: Strikes decay over time

---

## 📊 Health Monitoring

21 health checks across:

- Database connectivity
- External API availability (NewsAPI, Guardian, NYTimes)
- AI service status (Gemini, Translate)
- Memory usage
- Uptime tracking

**Endpoint**: `GET /api/v1/health`

---

## 🚨 Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": "Email or password is incorrect"
  }
}
```

**Error Code Ranges**:

- `AUTH_xxx`: Authentication errors
- `NEWS_xxx`: News fetching errors
- `AI_xxx`: AI processing errors
- `QUOTA_xxx`: Rate limit errors
- `DB_xxx`: Database errors

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Code Style

- Follow existing TypeScript patterns
- Use meaningful variable/function names
- Add JSDoc comments for complex logic
- Write unit tests for new features

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**Summary**: Free to use, modify, and distribute with attribution.

---

## 👨‍💻 Author

**Padmanabha Das**

- 📧 Email: [padmanabhadas9647@gmail.com](mailto:padmanabhadas9647@gmail.com)
- 💼 LinkedIn: [linkedin.com/in/padmanabha-das-59bb2019b](https://www.linkedin.com/in/padmanabha-das-59bb2019b/)
- 🐙 GitHub: [github.com/chayan-1906](https://github.com/chayan-1906)
- 📝 Medium: [chayan-1906.medium.com](https://chayan-1906.medium.com/)
- 💻 Dev.to: [dev.to/chayan-1906](https://dev.to/chayan-1906)

---

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful language models
- **NewsAPI.org**, **The Guardian**, **NY Times** for news data
- **Open-source community** for excellent libraries
- **MongoDB** for flexible data storage

---

## 📖 Additional Resources

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete endpoint reference
- **[Architecture Deep Dive](./PULSEPRESS_DOCUMENTATION.md)** - Technical documentation
- **[Issue Tracker](https://github.com/chayan-1906/PulsePress-Node.js/issues)** - Report bugs or request features

---

## 💡 Use Cases

- **News Applications**: Power mobile/web news apps
- **Content Aggregators**: Build custom news feeds
- **Research Tools**: Analyze news trends and sentiment
- **Enterprise Dashboards**: Monitor industry news
- **Educational Platforms**: Create comprehension exercises
- **Social Media Tools**: Generate shareable content

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ by [Padmanabha Das](https://github.com/chayan-1906)

</div>
