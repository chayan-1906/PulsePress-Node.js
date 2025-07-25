import "colors";
import {Request, Response} from "express";
import {AuthRequest} from "../types/auth";
import {ApiResponse} from "../utils/ApiResponse";
import {SummarizeArticleParams} from "../types/ai";
import {summarizeArticle} from "../services/AIService";
import {generateMissingCode, generateNotFoundCode} from "../utils/generateErrorCodes";

const summarizeArticleController = async (req: Request, res: Response) => {
    console.info('summarizeArticleController called'.bgMagenta.white.italic);

    try {
        const email = (req as AuthRequest).email;
        const {content, language, style}: SummarizeArticleParams = req.body;
        if (!content) {
            console.error('Content is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('content'),
                errorMsg: 'Content is missing',
            }));
            return;
        }

        const {summary, powered_by, error} = await summarizeArticle({email, content, language, style});
        if (error === generateMissingCode('email')) {
            console.error('Email is missing'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: generateMissingCode('email'),
                errorMsg: 'Email is missing',
            }));
            return;
        }
        if (error === generateNotFoundCode('user')) {
            console.error('User not found'.yellow.italic);
            res.status(404).send(new ApiResponse({
                success: false,
                errorCode: generateNotFoundCode('user'),
                errorMsg: 'User not found',
            }));
            return;
        }
        if (error === 'SUMMARIZATION_FAILED') {
            console.error('summarization failed'.yellow.italic);
            res.status(400).send(new ApiResponse({
                success: false,
                errorCode: 'SUMMARIZATION_FAILED',
                errorMsg: 'Can\'t summarize at the moment, try again after something',
            }));
            return;
        }
        console.log('article summarized:'.cyan.italic, {summary, powered_by});

        res.status(200).send(new ApiResponse({
            success: true,
            message: 'Article has been summarized 🎉',
            summary,
            powered_by,
        }));
    } catch (error: any) {
        console.error('ERROR: inside catch of summarizeArticleController:'.red.bold, error);
        res.status(500).send(new ApiResponse({
            success: false,
            errorCode: error.errorCode,
            errorMsg: error.message || 'Something went wrong',
        }));
    }
}

export {summarizeArticleController};
