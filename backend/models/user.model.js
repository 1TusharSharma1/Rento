import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * User Schema - Defines the data structure for users in the system
 * Includes authentication details, personal information, and role-based properties
 */
const userSchema = new mongoose.Schema(
  {
    // User's email address (unique identifier)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    // User's password (stored as hashed value)
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    // User's full name
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // User's phone number
    phone: {
      type: String,
      trim: true,
    },
    // URL to user's profile image
    profile_image: {
      type: String, // URL to the image
    },
    // Address information (required for sellers)
    address: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true
      },
      postal_code: {
        type: String,
        trim: true
      },
    },
    // User role determines permissions and access levels
    role: {
      type: String,
      enum: ['user', 'admin', 'seller'],
      default: 'user'
    },
    // Flag to indicate if account is locked/suspended
    isLocked: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true
  }
);

/**
 * Pre-save middleware to hash password before saving to database
 * Only hashes the password if it has been modified
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-validate middleware to ensure sellers have complete address information
 * Invalidates the document if a seller is missing address fields
 */
userSchema.pre('validate', function(next) {
  // If role is seller, require address fields
  if (this.role === 'seller') {
    if (!this.address || !this.address.street || !this.address.city || 
        !this.address.state || !this.address.country || !this.address.postal_code) {
      this.invalidate('address', 'Complete address is required for sellers');
    }
  }
  next();
});

/**
 * Method to verify if a provided password matches the stored hash
 * @param {string} password - Plain text password to check
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
userSchema.methods.isPasswordCorrect = async function(password) {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model('User', userSchema); 