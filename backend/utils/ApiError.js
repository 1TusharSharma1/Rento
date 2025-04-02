/**
 * Custom error class for API-related errors
 * Extends the native Error class with additional properties for API responses
 */
class ApiError extends Error {
    /**
     * Create a new API error
     * @param {number} statusCode - HTTP status code for the error
     * @param {string} message - Error message to display
     * @param {Array} errors - Array of detailed error messages or validation errors
     * @param {string} stack - Optional stack trace to use instead of generating a new one
     */
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;

        // Use provided stack trace or generate a new one
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default ApiError; 