import mongoose from 'mongoose';

// Conversation Schema - Stores Conversation Details
const conversationSchema = new mongoose.Schema(
  {
    participants: [{
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
      profile_image: String
    }],
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      index: true
    },
    vehicle_details: {
      title: String,
      images: [String]
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true
    },
    last_message: {
      text: String,
      sender: mongoose.Schema.Types.ObjectId,
      timestamp: Date
    },
    unread_count: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Message Schema
const messageSchema = new mongoose.Schema(
  {
    // Using MongoDB's built-in _id instead of manual message_id
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Denormalized sender data
    sender_details: {
      name: String,
      profile_image: String
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'document', 'location'],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      name: String,
      size: Number,
      mimetype: String
    }],
    read_by: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema); 