import "colors";
import {TArticleComplexities} from "../../types/news";

/*
* Workflow -
* Original Query: "The latest news about the Trump administration policy"
* Split by spaces using /\s+/: ["The", "latest", "news", "about", "the", "Trump", "administration", "policy"]
* Filter out noise words, short words, and numbers ["latest", "news", "Trump", "administration", "policy"]
* Create variations
  variations = [
    "The latest news about the Trump administration policy",  // Original
    "latest news Trump administration policy",                // No noise words
    "latest news Trump",                                      // First 3 words
    "latest news"                                             // First 2 words
  ]
*/
/**
 * Generate query variations by removing noise words and creating shorter versions
 */
const generateQueryVariations = (query: string): string[] => {
    console.log('Service: generateQueryVariations called'.cyan.italic, {query});

    if (!query) return [query];

    const noiseWords = [
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
        'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
        'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
    ];

    // Generic simplification approach
    const words = query.split(/\s+/).filter(word => word.length > 2 && !noiseWords.includes(word.toLowerCase()) && !/^\d+$/.test(word));

    const variations: string[] = [];

    // Original query
    variations.push(query);

    // Simplified version (remove noise words)
    if (words.length !== query.split(/\s+/).length) {
        variations.push(words.join(' '));
    }

    // Core keywords only (first 2-3 most important words)
    if (words.length > 3) {
        variations.push(words.slice(0, 3).join(' '));
        variations.push(words.slice(0, 2).join(' '));
    }

    return [...new Set(variations)];
}

/**
 * Simplify search query by taking the first variation
 */
const simplifySearchQuery = (query: string): string => {
    console.log('Service: simplifySearchQuery called'.cyan.italic, {query});

    return generateQueryVariations(query)[0];
}

/**
 * Clean scraped text by removing extra whitespace and newlines
 */
const cleanScrapedText = (text: string): string => {
    console.log('Service: cleanScrapedText called'.cyan.italic, {text});

    if (!text) return '';

    return text
        // Remove all types of newlines and replace with single space
        .replace(/\r\n|\r|\n/g, ' ')
        // Replace multiple spaces, tabs with single space
        .replace(/\s+/g, ' ')
        // Remove leading and trailing whitespace
        .trim();
}

/**
 * Count words in text content
 */
const countWords = (text: string): number => {
    console.log('Service: countWords called'.cyan.italic, {textLength: text.length});

    const words = text.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    console.log('Word count calculated'.cyan, {wordCount});
    return wordCount;
}

/**
 * Analyze sentence structure and calculate average words per sentence
 */
const analyzeSentenceStructure = (text: string): { sentenceCount: number; avgWordsPerSentence: number } => {
    console.log('Service: analyzeSentenceStructure called'.cyan.italic, {textLength: text.length});

    const wordCount = countWords(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const avgWordsPerSentence = wordCount / Math.max(1, sentenceCount);

    console.log('Sentence structure analyzed'.cyan, {sentenceCount, avgWordsPerSentence});
    return {sentenceCount, avgWordsPerSentence};
};

/**
 * Calculate reading time based on word count (200 words per minute)
 */
const calculateReadingTime = (text: string): number => {
    console.log('Service: calculateReadingTime called'.cyan.italic, {textLength: text.length});

    const wordCount = countWords(text);
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    console.log('Reading time calculated'.cyan, {wordCount, readingTimeMinutes});
    return readingTimeMinutes;
};

/**
 * Determine text complexity based on word count and sentence structure
 */
const assessTextComplexity = (text: string): TArticleComplexities => {
    console.log('Service: assessTextComplexity called'.cyan.italic, {textLength: text.length});

    const wordCount = countWords(text);
    const {avgWordsPerSentence} = analyzeSentenceStructure(text);

    let level: TArticleComplexities = 'easy';

    if (wordCount > 800 || avgWordsPerSentence > 20) {
        level = 'hard';
    } else if (wordCount > 400 || avgWordsPerSentence > 15) {
        level = 'medium';
    }

    console.log('Text complexity assessed'.cyan, {wordCount, avgWordsPerSentence, level});
    return level;
};

export {generateQueryVariations, simplifySearchQuery, cleanScrapedText, countWords, analyzeSentenceStructure, calculateReadingTime, assessTextComplexity};
