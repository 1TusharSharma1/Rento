import mongoose from 'mongoose';

/**
 * Vehicle Schema - Defines the data structure for vehicles available for rental
 * Includes ownership information, categorization, pricing, and availability
 */
const vehicleSchema = new mongoose.Schema(
  {
    // Reference to the user who owns this vehicle
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Denormalized owner information for quick access
    owner_details: {
      name: String,
      email: String,
      phone: String
    },
    // Category name for filtering and organization
    category_name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    // Optional description of the category
    category_description: {
      type: String,
      trim: true
    },
    // Higher-level category for broader classification
    supercategory_name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    // Optional description of the supercategory
    supercategory_description: {
      type: String,
      trim: true
    },
    
    // Vehicle listing title
    title: {
      type: String,
      required: true,
      trim: true
    },
    // Detailed description of the vehicle
    description: {
      type: String,
      required: true,
      trim: true
    },
    
    // Pricing structure with local and outstation rates
    pricing: {
      // Base price for local rentals (per day/hour as appropriate)
      basePrice: {
        type: Number,
        required: true,
        index: true
      },
      // Price for outstation rentals (typically higher than base)
      basePriceOutstation: {
        type: Number,
        required: false,
        index: true
      }
    },
    
    // General location name for the vehicle
    location: {
      type: String,
      required: true,
      index: true
    },

    // Reference to the detailed address record
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address'
    },
    // Denormalized address details for quick access
    address_details: {
      street: String,
      city: String,
      state: String,
      country: String,
      postal_code: String
    },
    
    // Array of image URLs for the vehicle
    images: [{
      type: String // URLs to images
    }],
    
    // Special features or amenities of the vehicle
    features: [{
      type: String,
      trim: true
    }],
    
    // Technical specifications of the vehicle
    specifications: {
      type: Map,
      of: String
    },
    
    // Time periods when the vehicle is available for rental
    availability: [{
      start_date: {
        type: Date
      },
      end_date: {
        type: Date
        
      }
    }],
    
    // Aggregated rating information from reviews
    rating: {
      // Average star rating
      average: {
        type: Number,
        default: 0
      },
      // Number of ratings received
      count: {
        type: Number,
        default: 0
      }
    },
    
    // Current status of the vehicle
    status: {
      type: String,
      enum: ['available', 'unavailable', 'maintenance', 'deleted'],
      default: 'available',
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema); 