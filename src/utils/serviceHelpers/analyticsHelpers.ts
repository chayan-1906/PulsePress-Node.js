import "colors";
import {DEFAULT_ENGAGEMENT_WEIGHTS} from "../constants";

/**
 * Calculate engagement score based on weighted metrics
 */
export const calculateEngagementScore = (metrics: any): number => {
    console.log('Service: calculateEngagementScore called'.cyan.italic, {metrics});

    const {viewWeight, bookmarkWeight, completionWeight, readingTimeWeight} = DEFAULT_ENGAGEMENT_WEIGHTS;

    const viewScore = metrics.totalViews * viewWeight;
    const bookmarkScore = metrics.totalBookmarks * bookmarkWeight;
    const completionScore = metrics.totalCompletedReads * completionWeight;
    const readingTimeScore = (metrics.totalReadingTime / 60) * readingTimeWeight; // Convert to minutes

    return Math.round(viewScore + bookmarkScore + completionScore + readingTimeScore);
}
