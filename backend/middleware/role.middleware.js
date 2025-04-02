import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Middleware to restrict route access to admin users only
 * Must be used after the authenticate middleware
 * 
 * @param {Object} req - Express request object with attached user from authenticate middleware
 * @param {Object} req.user - User object from database
 * @param {string} req.user.role - User's role
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {ApiError} When user is not authenticated or not an admin
 */
export const isAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Access denied. Admin privileges required');
  }
  
  next();
});

/**
 * Middleware to restrict route access to seller users only
 * Must be used after the authenticate middleware
 * 
 * @param {Object} req - Express request object with attached user from authenticate middleware
 * @param {Object} req.user - User object from database
 * @param {string} req.user.role - User's role
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {ApiError} When user is not authenticated or not a seller
 */
export const isSeller = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  
  if (req.user.role !== 'seller') {
    throw new ApiError(403, 'Access denied. Seller privileges required');
  }
  
  next();
});

/**
 * Middleware to restrict route access to users with either admin or seller roles
 * Must be used after the authenticate middleware
 * 
 * @param {Object} req - Express request object with attached user from authenticate middleware
 * @param {Object} req.user - User object from database
 * @param {string} req.user.role - User's role
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {ApiError} When user is not authenticated or neither admin nor seller
 */
export const isAdminOrSeller = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'seller') {
    throw new ApiError(403, 'Access denied. Admin or seller privileges required');
  }
  
  next();
}); 