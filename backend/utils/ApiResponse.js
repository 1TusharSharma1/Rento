/**
 * Standard response format for API endpoints
 * Provides a consistent structure for all API responses
 */
class ApiResponse {
    /**
     * Create a new API response
     * @param {number} statusCode - HTTP status code for the response
     * @param {*} data - Response payload data
     * @param {string} message - Response message
     */
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400; // Success if status code is less than 400
    }
}

export default ApiResponse; 