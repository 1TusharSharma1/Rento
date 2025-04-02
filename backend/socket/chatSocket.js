import {Server} from 'socket.io';
import { Message, Conversation } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import mongoose from 'mongoose';

function chatSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:5502',
                'http://127.0.0.1:5502',
                'http://localhost:3000',
                'http://localhost:8080',
                'http://localhost:5173',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:8080',
                'http://127.0.0.1:5173'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Socket.IO middleware to store user data
    io.use(async (socket, next) => {
        const userId = socket.handshake.auth.userId;
        if (!userId) {
            return next(new Error('Authentication error'));
        }

        try {
            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return next(new Error('User not found'));
            }

            // Store user data in socket for later use
            socket.userId = userId;
            socket.userName = user.name;
            socket.userProfile = user.profile_image || '';
            
            return next();
        } catch (error) {
            console.error('Socket auth error:', error);
            return next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log('New client connected', socket.id);

        // Join user to their room (for direct messages)
        socket.join(socket.userId);

        // Join specific conversation
        socket.on("joinConversation", (conversationId) => {
            console.log(`User ${socket.userId} joined conversation ${conversationId}`);
            socket.join(conversationId);
        });

        // Leave conversation
        socket.on("leaveConversation", (conversationId) => {
            console.log(`User ${socket.userId} left conversation ${conversationId}`);
            socket.leave(conversationId);
        });

        // Send message
        socket.on("sendMessage", async (data) => {
            try {
                const { conversationId, text, attachment } = data;
                
                // Validate input
                if (!conversationId || (!text && !attachment)) {
                    socket.emit('error', { message: 'Invalid message data' });
                    return;
                }

                // Find conversation and verify user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) {
                    socket.emit('error', { message: 'Conversation not found' });
                    return;
                }

                // Check if user is a participant
                const isParticipant = conversation.participants.some(
                    participant => participant.user.toString() === socket.userId
                );

                if (!isParticipant) {
                    socket.emit('error', { message: 'Not authorized to send messages in this conversation' });
                    return;
                }

                // Create message in database
                const newMessage = await Message.create({
                    conversation: conversationId,
                    sender: socket.userId,
                    sender_details: {
                        name: socket.userName,
                        profile_image: socket.userProfile
                    },
                    text: text || '',
                    attachments: attachment ? [{
                        type: 'image', 
                        url: attachment,
                        name: 'attachment.jpg',
                        mimetype: 'image/jpeg'
                    }] : []
                });

                // Find other participant to update their unread count
                const otherParticipant = conversation.participants.find(
                    p => p.user.toString() !== socket.userId
                );

                // Update conversation's last message
                await Conversation.findByIdAndUpdate(conversationId, {
                    last_message: {
                        text: text || 'Attachment',
                        sender: socket.userId,
                        timestamp: new Date()
                    },
                    $inc: { [`unread_count.${otherParticipant.user}`]: 1 }
                });

                // Get updated message with populated data
                const populatedMessage = await Message.findById(newMessage._id);

                // Emit message to the conversation room (including sender)
                io.to(conversationId).emit("newMessage", populatedMessage);
                
                // Also emit to the other participant's personal room
                // (in case they're not currently in the conversation view)
                io.to(otherParticipant.user.toString()).emit("messageNotification", {
                    message: populatedMessage,
                    conversation: conversation
                });
            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Mark messages as read
        socket.on("markAsRead", async (conversationId) => {
            try {
                if (!mongoose.Types.ObjectId.isValid(conversationId)) {
                    socket.emit('error', { message: 'Invalid conversation ID' });
                    return;
                }

                // Update messages
                await Message.updateMany(
                    { 
                        conversation: conversationId,
                        sender: { $ne: socket.userId },
                        'read_by.user': { $ne: socket.userId }
                    },
                    { 
                        $addToSet: { 
                            read_by: { 
                                user: socket.userId, 
                                timestamp: new Date() 
                            } 
                        } 
                    }
                );

                // Reset unread count for this user
                await Conversation.findByIdAndUpdate(
                    conversationId,
                    { $set: { [`unread_count.${socket.userId}`]: 0 } }
                );

                // Notify the conversation about the read status
                io.to(conversationId).emit("messagesRead", {
                    conversationId,
                    userId: socket.userId
                });
            } catch (error) {
                console.error('Error marking messages as read:', error);
                socket.emit('error', { message: 'Failed to mark messages as read' });
            }
        });

        // Handle typing indicators
        socket.on("typing", (conversationId) => {
            socket.to(conversationId).emit("userTyping", {
                conversationId,
                userId: socket.userId,
                userName: socket.userName
            });
        });

        socket.on("stopTyping", (conversationId) => {
            socket.to(conversationId).emit("userStoppedTyping", {
                conversationId,
                userId: socket.userId
            });
        });

        // Handle disconnection
        socket.on("disconnect", () => {
            console.log('Client disconnected', socket.id);
        });
    });
}

export default chatSocket;