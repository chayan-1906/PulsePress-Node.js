import 'colors';
import {customAlphabet} from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const generateNanoIdWithAlphabet = (length: number = 24, customAlphabetString: string = alphabet) => {
    try {
        const nanoId = customAlphabet(customAlphabetString, length);
        return nanoId();
    } catch (error: any) {
        console.error('Failed to generate NanoID:'.red.bold, error);
        throw new Error('Failed to generate NanoID');
    }
}

export default generateNanoIdWithAlphabet;
