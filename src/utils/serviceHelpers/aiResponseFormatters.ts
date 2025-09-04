import "colors";
import {API_CONFIG} from "../constants";

/**
 * Clean JSON response by removing markdown formatting
 */
const cleanJsonResponseMarkdown = (responseText: string): string => {
    console.log('Service: cleanJsonResponseMarkdown called'.cyan.italic);

    let cleanedText = responseText.trim();

    if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.substring(7);
    }
    if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.substring(3);
    }
    if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    }
    cleanedText = cleanedText.trim();

    if (cleanedText !== responseText.trim()) {
        console.log('Service: JSON markdown stripped'.cyan, cleanedText);
    }

    return cleanedText;
}

/**
 * Truncate content to avoid AI API token limits
 */
const truncateContentForAI = (content: string, maxLength: number = API_CONFIG.NEWS_API.MAX_CONTENT_LENGTH): string => {
    console.log('Service: truncateContentForAI called'.cyan.italic, {contentLength: content.length, maxLength});

    if (!content) return '';

    const truncated = content.substring(0, maxLength);

    if (truncated.length < content.length) {
        console.log(`Content truncated from ${content.length} to ${truncated.length} characters`.cyan);
    }

    return truncated;
}

export {cleanJsonResponseMarkdown, truncateContentForAI};
