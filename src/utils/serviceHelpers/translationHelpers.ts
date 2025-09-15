import "colors";
import {Translate} from "@google-cloud/translate/build/src/v2";
import {GOOGLE_TRANSLATE_API_KEY} from "../../config/config";
import {CONTENT_LIMITS} from "../constants";

const translate = new Translate({key: GOOGLE_TRANSLATE_API_KEY});

/**
 * Translate text to target language using Google Translate API
 */
const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    console.log('Service: translateText called'.cyan.italic, {text: text.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...', targetLanguage});

    try {
        if (!GOOGLE_TRANSLATE_API_KEY) {
            console.warn('Config Warning: Google Translate API key not configured'.yellow.italic);
            return text; // fallback to original text
        }

        console.log('External API: Translating text using Google Translate'.magenta);
        const [translation] = await translate.translate(text, {
            to: targetLanguage, // 'bn' for Bengali, 'hi' for Hindi, etc.
        });
        console.log('Translation completed:'.cyan, translation.substring(0, CONTENT_LIMITS.SUMMARY_PREVIEW_LENGTH) + '...');
        return translation;
    } catch (error: any) {
        console.error('Service Error: translateText failed'.red.bold, error);
        return text; // fallback to original text
    }
}

export {translateText};
