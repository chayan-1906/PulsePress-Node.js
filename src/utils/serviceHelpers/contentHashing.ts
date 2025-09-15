import "colors";
import crypto from "crypto";
import {CONTENT_LIMITS} from "../constants";

/**
 * Generate MD5 hash for content caching
 */
const generateContentHash = (content: string): string => {
    console.log('Service: generateContentHash called'.cyan.italic, {contentLength: content.length});

    const hash = crypto.createHash('md5').update(content.trim()).digest('hex');
    console.log('Content hash for caching:'.cyan, hash);

    return hash;
}

/**
 * Generate SHA256 hash for article content with language and style parameters
 */
const generateSummarizationContentHash = (articleContent: string, language: string = 'en', style: string = 'standard'): string => {
    console.log('Service: generateSummarizationContentHash called'.cyan.italic, {articleContent: articleContent.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...', language, style});

    const data = `${articleContent}::${language}::${style}`;
    const contentHash = crypto.createHash('sha256').update(data).digest('hex');
    console.log('Content hash generated:'.cyan, contentHash);

    return contentHash;
}

export {generateContentHash, generateSummarizationContentHash};
