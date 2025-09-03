import "colors";

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
export const generateQueryVariations = (query: string): string[] => {
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
export const simplifySearchQuery = (query: string): string => {
    console.log('Service: simplifySearchQuery called'.cyan.italic, {query});

    return generateQueryVariations(query)[0];
}

/**
 * Clean scraped text by removing extra whitespace and newlines
 */
export const cleanScrapedText = (text: string): string => {
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
