import ApiResponse from './ApiResponse.js';
import ApiError from './ApiError.js';

/**
 * Higher-order function to wrap async Express route handlers
 * Automatically catches errors and forwards them to Express error middleware
 * Eliminates the need for try/catch blocks in every route handler
 * 
 * @param {Function} fn - Async route handler function to wrap
 * @returns {Function} Wrapped handler that catches and forwards errors
 */
const asyncHandler = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        }
        catch (err) {
            // Pass error to global error handler
            // If it's already an ApiError instance, pass it directly
            // Otherwise, convert it to an ApiError with appropriate status code
            next(err instanceof ApiError ? err : new ApiError(
                err.statusCode || 500,
                err.message || 'Internal Server Error',
                err.errors || []
            ));
        }
    }
}

export default asyncHandler;