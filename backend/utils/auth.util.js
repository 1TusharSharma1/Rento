import jwt from 'jsonwebtoken';

/**
 * Generates a JWT token for user authentication
 * @param {Object} user - User object from database
 * @param {string|ObjectId} user._id - User's unique identifier
 * @param {string} user.email - User's email address
 * @param {string} user.role - User's role (e.g., 'user', 'admin', 'seller')
 * @returns {string} JWT token
 * @throws {Error} If user data is invalid or token generation fails
 */
export const generateToken = (user) => {
  if (!user || !user._id) {
    throw new Error('Invalid user data for token generation');
  }

  // Create payload with essential user information
  // Do not include sensitive data like password
  const payload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };
  
  // Token configuration options
  const options = {
    expiresIn: process.env.JWT_EXPIRY || '30d'
  };

  try {
    // Sign token with secret key
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      options
    );
    return token;
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate authentication token');
  }
}; 