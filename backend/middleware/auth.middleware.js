import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Authentication middleware to verify user tokens and attach user to request
 * Checks for tokens in cookies or authorization header
 * Verifies token validity and fetches corresponding user from database
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @throws {ApiError} When authentication fails for any reason
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;  
  // Extract token from cookies or Authorization header
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
    console.log('Token' ,req.cookies.auth_token);
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Reject request if no token is found
  if (!token) {
    throw new ApiError(401, 'Authentication required. Please login');
  }
  
  try {
    // Decode and verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID from token payload
    const user = await User.findById(decoded.id).select('-password');
    
    // Handle case where user no longer exists
    if (!user) {
      throw new ApiError(401, 'User not found or session expired');
    }
    
    // Check if user account is locked
    // Allow logout even if account is locked
    if (user.isLocked && req.originalUrl !== '/api/v1/auth/logout') {
      throw new ApiError(403, 'Your account has been locked. Please contact support for assistance.');
    }
    
    // Attach user object to request for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle specific JWT error types with appropriate messages
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token. Please login again');
    }
    
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired. Please login again');
    }
    
    // Generic authentication failure
    throw new ApiError(401, 'Authentication failed');
  }
});