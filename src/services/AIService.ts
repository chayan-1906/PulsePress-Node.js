import "colors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {IUser} from "../models/UserSchema";
import {getUserByEmail} from "./AuthService";
import {GEMINI_API_KEY} from "../config/config";
import {SummarizeArticleParams} from "../types/ai";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

// Initialize with API key
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

const summarizeArticle = async ({email, content, language = 'English', style = 'standard'}: SummarizeArticleParams) => {
    try {
        if (!email) {
            return {error: generateMissingCode('email')};
        }

        const user: IUser | null = await getUserByEmail({email});
        if (!user) {
            return {error: generateNotFoundCode('user')};
        }

        const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash'});

        let prompt = '';
        if (style === 'concise') {
            prompt = `Summarize the following news article in 20% of its original length in ${language}. Focus only on the key facts and avoid unnecessary details.\n Content: ${content}`;
        } else if (style === 'standard') {
            prompt = `Provide a balanced summary of the following news article in 40% of its original length in ${language}. Include the main points while keeping the core context intact.\n Content: ${content}`;
        } else if (style === 'detailed') {
            prompt = `Summarize the following news article in 60% of its original length in ${language}. Include more context and background to preserve the depth of the article.\n Content: ${content}`;
        }

        const summarizedArticleResponse = await model.generateContent(prompt);
        const text = summarizedArticleResponse.response.text();
        if (!text || text.trim() === '') {
            return {error: 'SUMMARIZATION_FAILED'};
        }

        return {
            summary: summarizedArticleResponse.response.text(),
            powered_by: 'Google Gemini AI',
        };
    } catch (error: any) {
        console.error('ERROR: inside catch of summarizeArticle:'.red.bold, error);
        throw error;
    }
}

export {summarizeArticle};
