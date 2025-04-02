import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { User } from '../models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment check: JWT_SECRET is', process.env.JWT_SECRET ? 'set' : 'NOT SET');

// Check if JWT_SECRET is available
const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  console.error('WARNING: JWT_SECRET is not set');
  console.error('Using fallback secret for development only. (Backup Key)');
}

// Custom extractor that tries multiple methods
const fromCookieOrAuthHeader = (req) => {
  // First try to get the token from cookies
  if (req && req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  
  // Then from Authorization header
  const authHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (authHeader) {
    return authHeader;
  }
  
  return null;
};

const options = {
  jwtFromRequest: fromCookieOrAuthHeader,
  secretOrKey: process.env.JWT_SECRET || 'fallback-development-secret',
  passReqToCallback: true,
  jsonWebTokenOptions: {
    maxAge: '30d'
  }
};

console.log('Initializing JWT strategy with options:', { 
  jwtFromRequest: options.jwtFromRequest ? 'Configured' : 'Not configured',
  secretOrKey: options.secretOrKey ? 'Secret provided' : 'No secret provided'
});

// Initialize JWT strategy
passport.use(
  new JwtStrategy(options, async (req, payload, done) => {
    try {
      if (!payload || !payload.id) {
        console.error('Invalid token payload:', payload);
        return done(null, false, { message: 'Invalid token payload' });
      }

      // Find the user by ID from the JWT payload
      const user = await User.findById(payload.id);
      
      if (!user) {
        console.error('User not found for ID:', payload.id);
        return done(null, false, { message: 'User not found' });
      }
      
      console.log(`JWT authentication successful for user: ${user._id} (${user.email})`);
      return done(null, user);
    } catch (error) {
      console.error('JWT authentication error:', error);
      return done(error, false);
    }
  })
);

export default passport; 