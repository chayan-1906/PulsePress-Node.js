import "colors";
import {ArticleComplexities} from "../types/news";
import {ReadingTimeComplexityParams, ReadingTimeComplexityResponse} from "../types/ai";

class ReadingTimeAnalysisService {
    /**
     * Calculate reading time and complexity for an article
     */
    static calculateReadingTimeComplexity({article}: ReadingTimeComplexityParams): ReadingTimeComplexityResponse {
        console.log('Service: ReadingTimeAnalysisService.calculateReadingTimeComplexity called'.cyan.italic, {article});

        const text = (article.content || article.description || '').toLowerCase();
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;

        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = wordCount / Math.max(1, sentences.length);

        let level: ArticleComplexities = 'easy';

        if (wordCount > 800 || avgWordsPerSentence > 20) {
            level = 'hard';
        } else if (wordCount > 400 || avgWordsPerSentence > 15) {
            level = 'medium';
        }

        const result = {level, readingTimeMinutes, wordCount};
        console.log('Reading time complexity analysis completed successfully'.green.bold, result);
        return result;
    }
}

export default ReadingTimeAnalysisService;
