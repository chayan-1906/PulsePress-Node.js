import "colors";
import {TSentimentResult} from "../../types/ai";

/**
 * Get emoji representation for sentiment
 */
const getSentimentEmoji = (sentiment: TSentimentResult): string => {
    console.log('Service: getSentimentEmoji called'.cyan.italic, {sentiment});

    switch (sentiment) {
        case 'positive':
            return '😊';
        case 'negative':
            return '😔';
        case 'neutral':
            return '😐';
        default:
            return '❓';
    }
}

/**
 * Get color indicator for sentiment (for UI styling)
 */
const getSentimentColor = (sentiment: TSentimentResult): string => {
    console.log('Service: getSentimentColor called'.cyan.italic, {sentiment});

    switch (sentiment) {
        case 'positive':
            return 'green';
        case 'negative':
            return 'red';
        case 'neutral':
            return 'gray';
        default:
            return 'gray';
    }
}

export {getSentimentEmoji, getSentimentColor};
