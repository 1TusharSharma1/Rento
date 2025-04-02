import mongoose from 'mongoose';

// Address Schema - Stores Address Details
const addressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    postal_code: {
      type: String,
      required: true,
      trim: true
    },
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

export const Address = mongoose.model('Address', addressSchema); 