import express from 'express';
import {
  createMessage,
  getConversationMessages,
  getUserConversations,
  createConversation,
  markConversationAsRead,
  getConversationById
} from '../controllers/message.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply JWT verification to all routes
router.use(authenticate);

// Message routes
router.post('/messages', createMessage);

// Conversation routes
router.get('/conversations', getUserConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId', getConversationById);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/read', markConversationAsRead);

export default router; 