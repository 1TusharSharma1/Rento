import { User } from '../models/user.model.js';
import { generateToken } from '../utils/auth.util.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendWelcomeEmail } from '../utils/email.util.js';

// Cookie configuration for authentication tokens
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', 
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/'
};


/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {string} req.body.name - User name
 * @param {string} [req.body.role] - User role (optional)
 * @param {Object} [req.body.address] - User address (required for sellers)
 * @param {Object} res - Express response object
 * @returns {Object} API response with user data and token
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name, role, address } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  // Prepare user data
  const userData = {
    email,
    password,
    name,
  };

  // If registering as a seller, validate and add address and role
  if (role === 'seller') {
    if (!address || !address.street || !address.city || 
        !address.state || !address.country || !address.postal_code) {
      throw new ApiError(400, 'Complete address is required for seller registration');
    }
    
    userData.role = 'seller';
    userData.address = address;
  }

  const user = await User.create(userData);

  // Generate token
  const token = generateToken(user);
  
  // Set token in HTTP-only cookie
  res.cookie('auth_token', token, COOKIE_OPTIONS);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(user).catch(err => 
    console.error('Error while sending welcome email:', err)
  );

  // Send response
  return res
  .status(201).json(
    new ApiResponse(201, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.role === 'seller' && { address: user.address })
      },
      token // Include token in response for frontend reference
    }, 'User registered successfully')
  );
});

/**
 * Authenticate a user and return a token
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Object} API response with user data and token
 */
export const login = asyncHandler(async (req, res) => {
  console.log('Login request received:', req.body);
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if user is locked
  if (user.isLocked) {
    throw new ApiError(403, 'Your account has been locked. Please contact support for assistance.');
  }

  // Check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate token
  const token = generateToken(user);
  
  // Set token in HTTP-only cookie
  res.cookie('auth_token', token, COOKIE_OPTIONS);

  // Send response
  return res.status(200).json(
    new ApiResponse(200, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isLocked: user.isLocked,
        ...(user.role === 'seller' && { address: user.address })
      },
      token // Include token in response for frontend reference
    }, 'Logged in successfully')
  );
});

/**
 * Upgrade a user account to seller status
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} req.body - Request body
 * @param {Object} req.body.address - Seller address details
 * @param {Object} res - Express response object
 * @returns {Object} API response with updated user data and token
 */
export const becomeSeller = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { address } = req.body;

  // Validate address data
  if (!address || !address.street || !address.city || 
      !address.state || !address.country || !address.postal_code) {
    throw new ApiError(400, 'Complete address is required to become a seller');
  }

  // Update user to seller role and add address
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 
      role: 'seller',
      address: address
    },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new ApiError(404, 'User not found');
  }

  // Generate new token with updated role
  const token = generateToken(updatedUser);
  
  // Set new token in HTTP-only cookie
  res.cookie('auth_token', token, COOKIE_OPTIONS);

  // Send response
  return res.status(200).json(
    new ApiResponse(200, {
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        address: updatedUser.address
      },
      token // Include token in response for frontend reference
    }, 'Successfully upgraded to seller account')
  );
});

/**
 * Log out the current user by clearing their authentication cookie
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} API response confirming logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Clear the authentication cookie
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });

  return res.status(200).json(
    new ApiResponse(200, {}, 'Logged out successfully')
  );
});

/**
 * Get current authenticated user's profile
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Object} API response with current user data
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  // The authenticate middleware already attached the user to req.user
  const user = req.user;
  
  if (!user) {
    throw new ApiError(401, 'User not authenticated');
  }
  
  // Return user data (excluding sensitive fields like password)
  return res.status(200).json(
    new ApiResponse(200, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isLocked: user.isLocked,
        profile_image: user.profile_image,
        createdAt: user.createdAt,
        ...(user.role === 'seller' && { address: user.address })
      }
    }, 'User retrieved successfully')
  );
}); 