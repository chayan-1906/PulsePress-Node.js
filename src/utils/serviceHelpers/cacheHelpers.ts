import "colors";
import CachedQuestionAnswerModel from "../../models/CachedQuestionAnswerSchema";
import CachedSummaryModel, {ICachedSummary} from "../../models/CachedSummarySchema";
import {CONTENT_LIMITS} from "../constants";

/**
 * Cache generated questions
 */
const cacheQuestions = async (contentHash: string, questions: string[]): Promise<void> => {
    console.log('Service: cacheQuestions called'.cyan.italic, {contentHash, questions});

    try {
        await CachedQuestionAnswerModel.findOneAndUpdate(
            {contentHash},
            {
                $set: {questions},
                $setOnInsert: {
                    createdAt: new Date(),
                    answers: new Map(),
                },
            },
            {upsert: true, new: true},
        );
        console.log('Cache: Questions cached successfully'.cyan);
    } catch (error) {
        console.error('Service Error: Failed to cache questions:'.red.bold, error);
    }
}

/**
 * Cache generated answer
 */
const cacheAnswer = async (contentHash: string, question: string, answer: string): Promise<void> => {
    console.log('Service: cacheAnswer called'.cyan.italic, {contentHash, question, answer});

    try {
        await CachedQuestionAnswerModel.findOneAndUpdate(
            {contentHash},
            {
                $set: {
                    [`answers.${question}`]: answer,
                },
                $setOnInsert: {
                    createdAt: new Date(),
                    questions: [],
                },
            },
            {upsert: true, new: true},
        );
        console.log('Cache: Answer cached successfully'.cyan);
    } catch (error) {
        console.error('Service Error: Failed to cache answer:'.red.bold, error);
    }
}

/**
 * Save generated summary to cache with content hash and metadata
 */
const saveSummaryToCache = async (contentHash: string, summary: string, language: string, style: string): Promise<ICachedSummary | null> => {
    console.log('Service: saveSummaryToCache called'.cyan.italic, {contentHash, summary: summary.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...', language, style});

    try {
        /*if (NODE_ENV !== 'production') {
            console.log('Caching disabled in development mode'.cyan);
            return null;
        }*/

        const savedContentHash: ICachedSummary | null = await CachedSummaryModel.create({contentHash, summary, language, style});
        console.log('Saved content hash to cache:'.cyan, savedContentHash);
        return savedContentHash;
    } catch (error: any) {
        console.error('Service Error: saveSummaryToCache failed'.red.bold, error);
        throw error;
    }
}

/**
 * Retrieve cached summary by content hash
 */
const getCachedSummary = async (contentHash: string): Promise<ICachedSummary | null> => {
    console.log('Service: getCachedSummary called'.cyan.italic, {contentHash});

    try {
        /*if (NODE_ENV !== 'production') {
            console.log('Caching disabled in development mode'.cyan);
            return null;
        }*/

        const cachedSummary: ICachedSummary | null = await CachedSummaryModel.findOne({contentHash});
        console.log('Retrieved cached summary:'.cyan, cachedSummary ? 'Found' : 'Not found');
        return cachedSummary;
    } catch (error: any) {
        console.error('Service Error: getCachedSummary failed'.red.bold, error);
        return null;
    }
}

export {cacheQuestions, cacheAnswer, saveSummaryToCache, getCachedSummary};
