import {IMPACT_LEVELS} from "../types/ai";

const AI_PROMPTS = {
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

        Each tag should represent a meaningful category that is directly relevant to the news content, helping users better understand and filter information`;
    },

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

        Each key point should be a clear, concise statement`;
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
        Reasoning should briefly explain the rating`;
    },

    SUMMARIZATION: {
        CONCISE: (content: string) => `Summarize the following news article in 20% of its original length. Focus only on the key facts and avoid unnecessary details.

        IMPORTANT LANGUAGE REQUIREMENTS:
        - Use simple, clear English that everyone can understand
        - Avoid complex words, technical jargon, or confusing terms  
        - Write like you're explaining to a friend in everyday conversation
        - Use short, simple sentences that are easy to read
        - Make it accessible for all people, including non-native English speakers

        Content: ${content}`,
        STANDARD: (content: string) => `Provide a balanced summary of the following news article in 40% of its original length. Include the main points while keeping the core context intact.

        IMPORTANT LANGUAGE REQUIREMENTS:
        - Use simple, clear English that everyone can understand
        - Avoid complex words, technical jargon, or confusing terms
        - Write like you're explaining to a friend in everyday conversation  
        - Use short, simple sentences that are easy to read
        - Make it accessible for all people, including non-native English speakers

        Content: ${content}`,
        DETAILED: (content: string) => `Summarize the following news article in 60% of its original length. Include more context and background to preserve the depth of the article.

        IMPORTANT LANGUAGE REQUIREMENTS:
        - Use simple, clear English that everyone can understand
        - Avoid complex words, technical jargon, or confusing terms
        - Write like you're explaining to a friend in everyday conversation
        - Use short, simple sentences that are easy to read  
        - Make it accessible for all people, including non-native English speakers

        Content: ${content}`
    },

    NEWS_CLASSIFICATION: (content: string) => {
        return `Read the given content properly and classify it as either news or non_news content

        NEWS content includes: current events, breaking news, recent developments, sports events, business news, political news, technology news
        NON-NEWS content includes: educational content, tutorials, personal emails, notifications, advertisements, historical information, general knowledge

        Content to classify: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"classification": "news", "confidence": 0.85}

        Valid classification values: news, non_news
        Confidence must be a number between 0.1 and 1.0`;
    },

    QUESTION_GENERATION: (content: string) => {
        return `Analyze this news article and generate 3-5 short, simple questions that readers might naturally ask after reading it.

        Guidelines for question generation:
        - Keep questions very short (maximum 8-10 words)
        - Use simple, everyday vocabulary that anyone can understand
        - Focus on basic "what", "why", "how", "when", or "what next" questions
        - Make questions conversational and direct
        - Avoid complex terms, multiple clauses, or academic language
        - Questions should be easy to understand for non-native English speakers
        - Avoid questions already clearly answered in the article

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"questions": ["What happens next?", "Why did this happen?", "How will this help?"]}

        Each question should be short, simple, and easy to understand`;
    },

    QUESTION_ANSWERING: (content: string, question: string) => {
        return `You are an AI assistant that answers questions about news articles. Based on the provided article content and the specific question asked, provide a comprehensive and accurate answer.

        Guidelines for answering:
        - Answer based strictly on the information provided in the article
        - If the article doesn't contain enough information to fully answer the question, acknowledge this clearly
        - Provide context and background when helpful
        - Keep the answer informative but concise (2-4 sentences typically)
        - Use a clear, professional tone
        - If the question asks for speculation about future events, base your response on facts from the article and clearly indicate any uncertainty

        Article content: "${content}"

        Question: "${question}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"answer": "Based on the article, the implementation will begin next quarter and is expected to impact approximately 50,000 residents by providing new healthcare services."}

        The answer should be comprehensive yet concise, directly addressing the question asked`;
    },

    GEOGRAPHIC_EXTRACTION: (content?: string) => {
        const instructions = `Analyze this news article content and extract ALL geographic locations mentioned in the text. Be comprehensive and thorough.

        Guidelines for geographic extraction:
        - Extract ALL cities, states/provinces, countries, regions, and geographic landmarks
        - Include locations mentioned directly OR indirectly (e.g., "the capital" if context shows it's Washington D.C.)
        - Include location abbreviations and their full names (e.g., both "NYC" and "New York City" if both appear)
        - Include locations in company names, event names, or proper nouns (e.g., "California-based Tesla")
        - Use standard, internationally recognized names when possible
        - For ambiguous names, choose the most likely interpretation based on context
        - Include up to 10 locations maximum to be comprehensive
        - Sort by importance to the news story: most central/relevant locations first
        - Avoid generic terms like "overseas", "abroad", "local area" unless they refer to specific places in context

        Examples of what TO include:
        - "Silicon Valley" → "Silicon Valley"  
        - "the Bay Area" → "San Francisco Bay Area"
        - "DC" → "Washington D.C."
        - "Tesla's Austin factory" → "Austin"
        - "border region" → [specific border if mentioned]`;

        if (!content) {
            return instructions;
        }

        return `${instructions}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"locations": ["New York City", "California", "United States", "Silicon Valley"]}

        Each location should be a clear, properly formatted geographic name. Be thorough - don't miss any locations mentioned in the text`;
    },

    SOCIAL_MEDIA_CAPTION: (content: string, platform?: string, style?: string) => {
        const platformLimits = {
            'twitter': 280,
            'instagram': 2200,
            'linkedin': 3000,
            'facebook': 63206,
        };

        const styleGuidelines = {
            'professional': 'Use formal tone, industry terminology, and authoritative language. Focus on credibility and expertise',
            'casual': 'Use conversational tone, everyday language, and a friendly approach. Keep it approachable and relatable',
            'engaging': 'Use questions, calls-to-action, and interactive elements. Encourage audience participation and discussion',
            'viral': 'Use trending terms, emojis, controversial takes, or surprising angles. Make it shareable and attention-grabbing',
        };

        const defaultPlatform = platform || 'twitter';
        const defaultStyle = style || 'engaging';
        const charLimit = platformLimits[defaultPlatform as keyof typeof platformLimits] || 280;
        const styleGuide = styleGuidelines[defaultStyle as keyof typeof styleGuidelines];

        return `Create an engaging social media caption for ${defaultPlatform} based on this news article.

        Platform: ${defaultPlatform}
        Character limit: ${charLimit} characters
        Style: ${defaultStyle} - ${styleGuide}

        Caption Requirements:
        - Stay within ${charLimit} character limit (including spaces and hashtags)
        - Capture the essence of the news story in an engaging way
        - Include 3-5 relevant hashtags that boost discoverability
        - Use appropriate tone for the platform and style
        - Make it compelling enough to encourage clicks and engagement
        - IMPORTANT: Use simple, clear English that everyone can easily understand
        - Avoid complex words, technical jargon, or confusing terms
        - Write like you're explaining to a friend in everyday conversation

        Platform-specific guidelines:
        ${defaultPlatform === 'twitter' ? '- Use Twitter-style brevity and punch\n- Include relevant trending hashtags\n- Consider using emojis sparingly' : ''}
        ${defaultPlatform === 'instagram' ? '- Use visual storytelling language\n- Include popular and niche hashtags\n- Use emojis and line breaks for readability' : ''}
        ${defaultPlatform === 'linkedin' ? '- Use professional tone and industry insights\n- Include business-relevant hashtags\n- Focus on professional implications' : ''}
        ${defaultPlatform === 'facebook' ? '- Use conversational tone\n- Include questions to encourage comments\n- Use emojis to add personality' : ''}

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {"caption": "Your engaging caption here", "hashtags": ["#News", "#Breaking", "#Technology"], "characterCount": 245}

        The caption should be optimized for ${defaultPlatform} with ${defaultStyle} style, staying under ${charLimit} characters total`;
    },

    NEWS_INSIGHTS_ANALYSIS: (content: string) => {
        return `Analyze this news article and provide comprehensive insights beyond just summarization. Act as an expert news analyst providing deeper understanding.

        LANGUAGE REQUIREMENTS:
        - CRITICAL: Use simple, clear English that any person can easily understand
        - Avoid technical jargon, complex words, or industry-specific terms
        - Write like you're explaining to a smart friend who isn't an expert
        - Use everyday words and short, clear sentences
        - Make it accessible to all education levels and backgrounds

        Analysis Requirements:

        KEY THEMES EXTRACTION:
        - Identify 3-5 main themes/topics covered in the article
        - Focus on broader categories (e.g., "Money Issues", "Weather Changes", "New Technology", "Countries Working Together")
        - Use clear, simple theme names that anyone can understand

        IMPACT ASSESSMENT:
        - Determine the significance level: local, regional, national, or global (use exactly these lowercase words)
        - Provide 1-2 sentence description explaining why this level of impact in simple terms
        - Consider both immediate and potential long-term effects
        - Explain what this means for regular people

        CONTEXT CONNECTIONS:
        - Identify 2-4 connections to recent related events, trends, or ongoing situations
        - Reference timeframes when relevant (e.g., "connects to problems that started in 2019")
        - Focus on meaningful connections that help readers understand the bigger picture
        - Explain connections in plain, simple language

        STAKEHOLDER ANALYSIS:
        - Winners: Who benefits from these developments (use simple, clear descriptions)
        - Losers: Who faces negative impacts or losses (explain in everyday terms)
        - Affected: Who is impacted but outcome is unclear or mixed
        - Use specific but simple descriptions that anyone can understand

        TIMELINE CONTEXT:
        - Identify 2-4 key background events or developments that led to this news
        - Provide context for "how we got here" in simple terms
        - Focus on recent relevant history (past 1-3 years typically)
        - Explain background events using clear, everyday language

        Article content: "${content}"

        CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.

        Return exactly this format:
        {
            "keyThemes": ["Theme 1", "Theme 2", "Theme 3"],
            "impactAssessment": {
                "level": "national",
                "description": "Description of why this impact level and what it means"
            },
            "contextConnections": ["Connection to event 1", "Connection to trend 2"],
            "stakeholderAnalysis": {
                "winners": ["Group 1", "Group 2"],
                "losers": ["Group 3", "Group 4"],
                "affected": ["Group 5", "Group 6"]
            },
            "timelineContext": ["Background event 1", "Background event 2"]
        }

        IMPORTANT: The level in impactAssessment must be exactly one of these lowercase words: ${IMPACT_LEVELS.join(', ')}

        Provide insightful, expert-level analysis that helps readers understand the deeper significance and context of this news`;
    },

    JSON_FORMAT_INSTRUCTIONS: `CRITICAL: Return ONLY the JSON object below. Do NOT wrap it in markdown code blocks, backticks, or any other formatting. Do NOT add any explanatory text before or after the JSON.`,
};

export {AI_PROMPTS};
