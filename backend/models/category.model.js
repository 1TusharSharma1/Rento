import mongoose from 'mongoose';

// Super Category Schema
const superCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Category Schema
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    supercategory_name: {
      type: String,
      required: true,
      index: true
    },
    supercategory_description: {
      type: String
    },
    supercategory_image: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export const SuperCategory = mongoose.model('SuperCategory', superCategorySchema);
export const Category = mongoose.model('Category', categorySchema); 