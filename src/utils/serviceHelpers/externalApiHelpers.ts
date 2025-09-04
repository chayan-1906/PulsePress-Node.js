import "colors";
import {TClassificationResult} from "../../types/ai";

/**
 * Process HuggingFace classification API response
 */
const processHuggingFaceResponse = (result: any): TClassificationResult => {
    console.log('Service: processHuggingFaceResponse called'.cyan.italic, {result});

    if (!result || !result.labels || !result.scores) {
        console.error('Service Error: Invalid HuggingFace API response format'.red.bold);
        throw new Error('Invalid HuggingFace API response format');
    }

    console.log('External API: HuggingFace response received'.magenta);
    const topLabelIndex = result.scores.indexOf(Math.max(...result.scores));
    const topLabel = result.labels[topLabelIndex];
    const topScore = result.scores[topLabelIndex];

    console.log('HuggingFace classification result processed'.cyan, {
        topLabel,
        topScore,
        allLabels: result.labels,
        allScores: result.scores,
    });

    if (topScore > 0.5) {
        if (topLabel.includes('current news') || topLabel.includes('breaking news')) {
            return 'news';
        } else if (topLabel.includes('educational') || topLabel.includes('non-news')) {
            return 'non_news';
        }
    }

    console.error('Service Error: Low confidence classification from HuggingFace'.red.bold, {topScore});
    throw new Error('Low confidence classification from HuggingFace');
}

export {processHuggingFaceResponse};
