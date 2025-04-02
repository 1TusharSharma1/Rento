import mongoose from 'mongoose';

// Bidding Schema - Stores Bidding Details
const biddingSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true
    },
    vehicle_details: {
      title: String,
      pricing: {
        basePrice: Number,
        basePriceOutstation: Number
      },
      images: [String]
    },
    bidder: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      govtId: {
        type: String,
        required: true
      }
    },
    seller: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
      },
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: String
    },
    bid_amount: {
      type: Number,
      required: true
    },
    bid_date: {
      type: Date,
      required: true,
      default: Date.now
    },
    booking_start_date: {
      type: Date,
      required: true,
      index: true
    },
    booking_end_date: {
      type: Date,
      required: true,
      index: true
    },
    is_outstation: {
      type: Boolean,
      default: false
    },
    bid_status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired', 'converted'],
      default: 'pending',
      index: true
    },
    bid_message: {
      type: String,
      trim: true
    },
    response_message: {
      type: String,
      trim: true
    },
    response_date: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);
// validation logic
// Booking Schema - Stores Booking Details
const bookingSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true
    },
    vehicle_details: {
      title: String,
      pricing: {
        basePrice: Number,
        basePriceOutstation: Number
      },
      images: [String],
      category_details: {
        name: String
      }
    },
    bid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bidding',
      index: true
    },
    renter: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: String
    },
    seller: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
      },
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: String
    },
    booking_start_date: {
      type: Date,
      required: true,
      index: true
    },
    booking_end_date: {
      type: Date,
      required: true,
      index: true
    },
    is_outstation: {
      type: Boolean,
      default: false
    },
    total_price: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending'
    },
    payment_id: {
      type: String
    },
    initial_odometer_reading: {
      type: Number
    },
    final_odometer_reading: {
      type: Number
    },
    trip_start_time: {
      type: Date
    },
    trip_end_time: {
      type: Date
    },
    extra_charges: {
      type: Number,
      default: 0
    },
    total_km: {
      type: Number
    },
    cancellation_reason: {
      type: String
    },
    cancellation_date: {
      type: Date
    },
    review: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: {
        type: String
      },
      date: {
        type: Date
      }
    }
  },
  {
    timestamps: true
  }
);

export const Bidding = mongoose.model('Bidding', biddingSchema);
export const Booking = mongoose.model('Booking', bookingSchema); 