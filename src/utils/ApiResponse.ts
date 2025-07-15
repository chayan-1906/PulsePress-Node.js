type ApiResponseParams = {
    success?: boolean;
    message?: string | null;
    errorCode?: string | number | null;
    errorMsg?: string | null;
    debugError?: any;
    [key: string]: any;
}

export class ApiResponse {
    success: boolean;
    message?: string;
    error?: { code?: string | number; message?: string };
    debugError?: any;

    [key: string]: any;

    constructor({success = false, message = null, errorCode = null, errorMsg = null, debugError = null, ...rest}: ApiResponseParams) {
        this.success = success;

        if (success && message !== null) this.message = message;
        if (!success) {
            const error: { code?: string | number; message?: string } = {};
            if (errorCode !== null) error.code = errorCode;
            if (errorMsg !== null) error.message = errorMsg;
            if (Object.keys(error).length) this.error = error;
            if (debugError !== null) this.debugError = debugError;
        }

        for (const [key, value] of Object.entries(rest)) {
            if (value !== null) this[key] = value;
        }
    }
}
