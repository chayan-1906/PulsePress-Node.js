import "colors";
import {IReadingTimeComplexityParams, IReadingTimeComplexityResponse} from "../types/ai";
import {assessTextComplexity, calculateReadingTime, countWords} from "../utils/serviceHelpers/textProcessing";

class ReadingTimeAnalysisService {
    /**
     * Calculate reading time and complexity for an article
     */
    static calculateReadingTimeComplexity({article}: IReadingTimeComplexityParams): IReadingTimeComplexityResponse {
        console.log('Service: ReadingTimeAnalysisService.calculateReadingTimeComplexity called'.cyan.italic, {article});

        const text = (article.content || article.description || '').toLowerCase();

        const wordCount = countWords(text);
        const readingTimeMinutes = calculateReadingTime(text);
        const level = assessTextComplexity(text);

        const result = {level, readingTimeMinutes, wordCount};
        console.log('Reading time complexity analysis completed successfully'.green.bold, result);
        return result;
    }
}

export default ReadingTimeAnalysisService;
