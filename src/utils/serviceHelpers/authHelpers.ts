import "colors";
import bcryptjs from "bcryptjs";

/**
 * Hash password using bcrypt with salt rounds
 */
const hashPassword = async (password: string): Promise<string> => {
    console.log('Service: hashPassword called'.cyan.italic, password);

    try {
        const hashedPassword = await bcryptjs.hash(password, 10);
        console.log('Password hashed'.cyan, hashedPassword);
        return hashedPassword;
    } catch (error: any) {
        console.error('Service Error: hashPassword failed'.red.bold, error);
        throw error;
    }
}

/**
 * Compare two plain text passwords for equality
 */
const comparePassword = (password1: string, password2: string): boolean => {
    console.log('Service: comparePassword called'.cyan.italic, {password1, password2});

    try {
        const isMatched = password1 === password2;
        if (!isMatched) {
            // throw new Error('Passwords don\'t match');
            return false;
        }

        return isMatched;
    } catch (error: any) {
        console.error('Service Error: comparePassword failed'.red.bold, error);
        throw error;
    }
}

/**
 * Verify plain text password against bcrypt hash
 */
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    console.log('Service: verifyPassword called'.cyan.italic, {password, hashedPassword});

    try {
        const isMatched = await bcryptjs.compare(password, hashedPassword);
        if (!isMatched) {
            // throw new Error('Invalid credentials');
            return false;
        }

        return isMatched;
    } catch (error: any) {
        console.error('Service Error: verifyPassword failed'.red.bold, error);
        throw error;
    }
}

export {hashPassword, comparePassword, verifyPassword};
