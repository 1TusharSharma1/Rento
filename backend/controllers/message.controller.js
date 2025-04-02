import mongoose from 'mongoose';
import { Message, Conversation } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import { Vehicle } from '../models/vehicle.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateObjectId } from '../utils/validations.js';

/**
 * Create a new message
 * @route POST /api/v1/messaging/messages
 * @access Private
 */
export const createMessage = asyncHandler(async (req, res) => {
  const { conversation_id, content, attachment } = req.body;
  const userId = req.user._id;

  // Validate basic inputs
  validateObjectId(conversation_id, 'conversation ID');
  
  if (!content && !attachment) {
    throw new ApiError(400, 'Message content or attachment is required');
  }

  // Find the conversation
  const conversation = await Conversation.findById(conversation_id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Check if user is a participant
  const isParticipant = conversation.participants.some(
    participant => participant.user.toString() === userId.toString()
  );

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }

  // Create message with sender details
  const newMessage = await Message.create({
    conversation: conversation_id,
    sender: userId,
    sender_details: {
      name: req.user.name,
      profile_image: req.user.profile_image || ''
    },
    text: content || '',
    attachments: attachment ? [{
      type: 'image', 
      url: attachment,
      name: 'image.jpg',
      mimetype: 'image/jpeg'
    }] : []
  });

  // Update the conversation's last message
  await Conversation.findByIdAndUpdate(conversation_id, {
    last_message: {
      text: content || 'Attachment',
      sender: userId,
      timestamp: new Date()
    },
    $inc: { [`unread_count.${conversation.participants.find(p => p.user.toString() !== userId.toString()).user}`]: 1 }
  });

  // Return the created message
  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: newMessage
  });
});

/**
 * Get messages for a conversation
 * @route GET /api/v1/messaging/conversations/:conversationId/messages
 * @access Private
 */
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  
  validateObjectId(conversationId, 'conversation ID');

  // Verify conversation exists and user is participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }
  
  const isParticipant = conversation.participants.some(
    participant => participant.user.toString() === userId.toString()
  );

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }

  // Fetch messages with pagination (latest messages first)
  const messages = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  // Mark messages as read
  await Message.updateMany(
    { 
      conversation: conversationId,
      sender: { $ne: userId },
      'read_by.user': { $ne: userId }
    },
    { 
      $addToSet: { 
        read_by: { 
          user: userId, 
          timestamp: new Date() 
        } 
      } 
    }
  );

  // Reset unread count for this user
  await Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { [`unread_count.${userId}`]: 0 } }
  );

  // Return messages in chronological order (oldest first)
  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages.reverse()
  });
});

/**
 * Get all conversations for the authenticated user
 * @route GET /api/v1/messaging/conversations
 * @access Private
 */
export const getUserConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find all conversations where the user is a participant
  const conversations = await Conversation.find({
    'participants.user': userId
  }).sort({ 'last_message.timestamp': -1 });

  res.status(200).json({
    success: true,
    count: conversations.length,
    data: conversations
  });
});

/**
 * Create a new conversation
 * @route POST /api/v1/messaging/conversations
 * @access Private
 */
export const createConversation = asyncHandler(async (req, res) => {
  const { participant_id, vehicle_id, initial_message } = req.body;
  const userId = req.user._id;

  // Validate inputs
  validateObjectId(participant_id, 'participant ID');
  if (vehicle_id) validateObjectId(vehicle_id, 'vehicle ID');

  // Check if recipient exists
  const recipient = await User.findById(participant_id);
  if (!recipient) {
    throw new ApiError(404, 'Recipient user not found');
  }

  // Prevent creating conversation with self
  if (participant_id === userId.toString()) {
    throw new ApiError(400, 'Cannot create conversation with yourself');
  }

  // Check if vehicle exists if provided
  let vehicle = null;
  if (vehicle_id) {
    vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle) {
      throw new ApiError(404, 'Vehicle not found');
    }
  }

  // Sort participant IDs to create a consistent conversation ID
  const participantIds = [userId.toString(), participant_id].sort();
  
  // Check if conversation already exists
  let conversation = await Conversation.findOne({
    'participants.user': { $all: [userId, participant_id] },
    ...(vehicle_id ? { vehicle: vehicle_id } : {})
  });

  // If conversation exists, return it
  if (conversation) {
    return res.status(200).json({
      success: true,
      message: 'Conversation already exists',
      data: conversation
    });
  }

  // Create new conversation
  conversation = await Conversation.create({
    participants: [
      {
        user: userId,
        name: req.user.name,
        email: req.user.email,
        profile_image: req.user.profile_image || ''
      },
      {
        user: recipient._id,
        name: recipient.name,
        email: recipient.email,
        profile_image: recipient.profile_image || ''
      }
    ],
    vehicle: vehicle_id || null,
    vehicle_details: vehicle ? {
      title: vehicle.title,
      images: vehicle.images
    } : null,
    unread_count: {
      [userId]: 0,
      [participant_id]: 0
    }
  });

  // If initial message is provided, create it
  if (initial_message) {
    const message = await Message.create({
      conversation: conversation._id,
      sender: userId,
      sender_details: {
        name: req.user.name,
        profile_image: req.user.profile_image || ''
      },
      text: initial_message,
      attachments: []
    });

    // Update conversation with last message
    await Conversation.findByIdAndUpdate(conversation._id, {
      last_message: {
        text: initial_message,
        sender: userId,
        timestamp: new Date()
      },
      $inc: { [`unread_count.${participant_id}`]: 1 }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Conversation created successfully',
    data: conversation
  });
});

/**
 * Mark a conversation as read
 * @route POST /api/v1/messaging/conversations/:conversationId/read
 * @access Private
 */
export const markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;
  
  validateObjectId(conversationId, 'conversation ID');

  // Find the conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Check if user is a participant
  const isParticipant = conversation.participants.some(
    participant => participant.user.toString() === userId.toString()
  );

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }

  // Mark all messages as read
  await Message.updateMany(
    { 
      conversation: conversationId,
      sender: { $ne: userId },
      'read_by.user': { $ne: userId }
    },
    { 
      $addToSet: { 
        read_by: { 
          user: userId, 
          timestamp: new Date() 
        } 
      } 
    }
  );

  // Reset unread count for this user
  await Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { [`unread_count.${userId}`]: 0 } }
  );

  res.status(200).json({
    success: true,
    message: 'Conversation marked as read'
  });
});

/**
 * Get a specific conversation by ID
 * @route GET /api/v1/messaging/conversations/:conversationId
 * @access Private
 */
export const getConversationById = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  validateObjectId(conversationId, 'conversation ID');

  // Find the conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found');
  }

  // Check if user is a participant
  const isParticipant = conversation.participants.some(
    participant => participant.user.toString() === userId.toString()
  );

  if (!isParticipant) {
    throw new ApiError(403, 'You are not a participant in this conversation');
  }

  res.status(200).json({
    success: true,
    data: conversation
  });
}); 