const AI_PROMPTS = {
    SENTIMENT_ANALYSIS: (content?: string) => {
        const instructions = `Analyze the sentiment of this news article content and determine if the overall tone is positive, negative, or neutral.

        Guidelines for sentiment classification:
        - POSITIVE: Good news, achievements, progress, solutions, celebrations, positive outcomes, uplifting stories
        - NEGATIVE: Bad news, problems, conflicts, disasters, failures, scandals, tragedies, concerning developments
        - NEUTRAL: Factual reporting without emotional tone, balanced coverage, informational updates, routine announcements

        Consider the overall impact and emotional tone of the article, not just individual words.`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"sentiment": "positive", "confidence": 0.85}

        Valid sentiment values: positive, negative, neutral
        Confidence must be a number between 0.1 and 1.0`;
    },

    KEY_POINTS_EXTRACTION: (content?: string) => {
        const instructions = `Analyze this news article content and extract 3-5 key points that summarize the most important information.

        Guidelines for key points extraction:
        - Focus on main facts, events, and outcomes mentioned in the article
        - Each point should be concise but informative (1-2 sentences max)
        - Prioritize factual information over opinions
        - Avoid redundancy between points
        - Present points in order of importance`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"keyPoints": ["Point 1", "Point 2", "Point 3"]}

        Each key point should be a clear, concise statement.`;
    },

    COMPLEXITY_METER: (content?: string) => {
        const instructions = `Analyze this news article content and rate its difficulty level based on vocabulary, sentence structure, and concepts.

        Guidelines for complexity rating:
        - EASY: Simple vocabulary, short sentences, common topics, accessible to general readers
        - MEDIUM: Moderate vocabulary, mixed sentence lengths, some technical terms but generally accessible
        - HARD: Complex vocabulary, long sentences, technical jargon, specialized knowledge required

        Consider:
        - Word difficulty and technical terminology
        - Sentence structure complexity
        - Concept abstraction level
        - Required background knowledge`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"complexityMeter": {"level": "medium", "reasoning": "Contains technical terms but accessible language"}}

        Valid level values: easy, medium, hard
        Reasoning should briefly explain the rating.`;
    },

    SUMMARIZATION: {
        CONCISE: (content: string) => `Summarize the following news article in 20% of its original length. Focus only on the key facts and avoid unnecessary details.

        Content: ${content}`,
        STANDARD: (content: string) => `Provide a balanced summary of the following news article in 40% of its original length. Include the main points while keeping the core context intact.

        Content: ${content}`,
        DETAILED: (content: string) => `Summarize the following news article in 60% of its original length. Include more context and background to preserve the depth of the article.

        Content: ${content}`
    },

    NEWS_CLASSIFICATION: (content?: string) => {
        const instructions = `Read the given content properly and classify it as either news or non_news content.

        NEWS content includes: current events, breaking news, recent developments, sports events, business news, political news, technology news.
        NON-NEWS content includes: educational content, tutorials, personal emails, notifications, advertisements, historical information, general knowledge.`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Content to classify: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"classification": "news", "confidence": 0.85}

        Valid classification values: news, non_news
        Confidence must be a number between 0.1 and 1.0`;
    },

    TAG_GENERATION: (content?: string) => {
        const instructions = `Analyze this news article and generate 3-5 relevant tags that categorize its content.

        Guidelines for tag generation:
        - Generate tags that represent the main topics, categories, or themes
        - Use single words or short phrases (1-3 words maximum)
        - Make tags specific and relevant to the article content
        - Avoid generic words like "news" or "article"`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON array below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        ["Politics", "Economy", "Breaking"]

        Each tag should represent a meaningful category that is directly relevant to the news content, helping users better understand and filter information.`;
    },

    JSON_FORMAT_INSTRUCTIONS: `CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.`,
};

export {AI_PROMPTS};
