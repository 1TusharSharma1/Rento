'use strict';

angular
  .module('carRentalApp')
  .service('MessagingService', MessagingService);

MessagingService.$inject = ['$q', 'DbService', 'AuthService', '$http', '$rootScope', '$timeout'];

function MessagingService($q, DbService, AuthService, $http, $rootScope, $timeout) {
  // API endpoint base
  const API_BASE_URL = 'http://localhost:5050/api/v1/messaging';
  
  // Socket.IO connection
  let socket = null;
  let isSocketConnected = false;
  
  const service = {
    loadUserConversations: loadUserConversations,
    markConversationAsRead: markConversationAsRead,
    getConversationById: getConversationById,
    loadMessagesByConversation: loadMessagesByConversation,
    sendMessage: sendMessage,
    createConversationIfNotExists: createConversationIfNotExists,
    createConversation: createConversation,
    initSocket: initSocket,
    disconnectSocket: disconnectSocket,
    joinConversation: joinConversation,
    leaveConversation: leaveConversation,
    on: on,
    emitTyping: emitTyping,
    emitStopTyping: emitStopTyping
  };
  
  return service;

  /**
   * Initialize Socket.IO connection
   * @returns {Promise} - Promise resolving when socket is connected
   */
  function initSocket() {
    if (isSocketConnected && socket) {
      return $q.resolve();
    }
    
    return $q(function(resolve, reject) {
      AuthService.getLoggedInUser()
        .then(function(currentUser) {
          if (!currentUser || !currentUser._id) {
            console.error('User not authenticated');
            return reject(new Error('Must be logged in to connect to chat'));
          }
          
          try {
            // Load the socket.io-client library dynamically if not available
            // This assumes the socket.io client library is included in the page
            if (!window.io) {
              console.error('Socket.IO client not found - chat functionality will be disabled');
              return reject(new Error('Socket.IO client not available'));
            }
            
            // Connect to Socket.IO server with authentication
            socket = io('http://localhost:5050', {
              auth: {
                userId: currentUser._id
              },
              withCredentials: true
            });
            
            // Handle connection events
            socket.on('connect', function() {
              console.log('Socket connected:', socket.id);
              isSocketConnected = true;
              $rootScope.$broadcast('socket:connected');
              resolve();
            });
            
            socket.on('connect_error', function(error) {
              console.error('Socket connection error:', error);
              isSocketConnected = false;
              reject(error);
            });
            
            socket.on('disconnect', function() {
              console.log('Socket disconnected');
              isSocketConnected = false;
              $rootScope.$broadcast('socket:disconnected');
            });
            
            socket.on('error', function(error) {
              console.error('Socket error:', error);
              $rootScope.$broadcast('socket:error', error);
            });
            
            // Setup default event handlers
            setupDefaultEventHandlers();
            
          } catch (error) {
            console.error('Error initializing socket:', error);
            reject(error);
          }
        })
        .catch(function(error) {
          console.error('Error getting logged in user:', error);
          reject(error);
        });
    });
  }
  
  /**
   * Setup default Socket.IO event handlers
   */
  function setupDefaultEventHandlers() {
    if (!socket) return;
    
    // Handle new messages
    socket.on('newMessage', function(message) {
      console.log('New message received:', message);
      $rootScope.$broadcast('socket:newMessage', message);
      
      // Update local storage with the new message
      DbService.getStore('messages', 'readwrite')
        .then(function(store) {
          const messageToStore = {
            message_id: message._id,
            conversation_id: message.conversation,
            sender_id: message.sender,
            content: message.text,
            attachment_url: message.attachments && message.attachments.length > 0 ? 
              message.attachments[0].url : null,
            timestamp: new Date(message.createdAt).toISOString(),
            status: "received"
          };
          
          store.put(messageToStore);
          
          // Update conversation's last message
          return DbService.getStore('conversations', 'readwrite');
        })
        .then(function(convStore) {
          return DbService.getRecord('conversations', message.conversation)
            .then(function(conversation) {
              if (conversation) {
                conversation.updated_at = new Date().toISOString();
                
                // Mark as unread if the message is from the other user
                const currentUser = AuthService.getLoggedInUser();
                if (currentUser && message.sender !== currentUser.user_id) {
                  conversation.isUnread = true;
                }
                
                return DbService.updateRecord('conversations', conversation);
              }
            });
        })
        .catch(function(error) {
          console.error('Error updating local storage with new message:', error);
        });
    });
    
    // Handle message notifications (for messages when not in the conversation)
    socket.on('messageNotification', function(data) {
      console.log('Message notification received:', data);
      $rootScope.$timeout(function() {
        $rootScope.$broadcast('socket:messageNotification', data);
      });
    });
    
    // Handle messages read status updates
    socket.on('messagesRead', function(data) {
      console.log('Messages marked as read:', data);
      $rootScope.$timeout(function() {
        $rootScope.$broadcast('socket:messagesRead', data);
      });
    });
    
    // Handle typing indicators
    socket.on('userTyping', function(data) {
      console.log('User typing:', data);
      $rootScope.$timeout(function() {
        $rootScope.$broadcast('socket:userTyping', data);
      });
    });
    
    socket.on('userStoppedTyping', function(data) {
      console.log('User stopped typing:', data);
      $rootScope.$timeout(function() {
        $rootScope.$broadcast('socket:userStoppedTyping', data);
      });
    });
  }
  
  /**
   * Disconnect Socket.IO connection
   */
  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
      isSocketConnected = false;
    }
  }
  
  /**
   * Join a conversation room
   * @param {string} conversationId - The ID of the conversation to join
   */
  function joinConversation(conversationId) {
    if (!socket || !isSocketConnected) {
      console.warn('Socket not connected. Cannot join conversation.');
      return initSocket().then(function() {
        socket.emit('joinConversation', conversationId);
      });
    }
    
    socket.emit('joinConversation', conversationId);
  }
  
  /**
   * Leave a conversation room
   * @param {string} conversationId - The ID of the conversation to leave
   */
  function leaveConversation(conversationId) {
    if (socket && isSocketConnected) {
      socket.emit('leaveConversation', conversationId);
    }
  }
  
  /**
   * Register a callback for a Socket.IO event
   * @param {string} eventName - The name of the event
   * @param {function} callback - The callback function
   */
  function on(eventName, callback) {
    if (socket) {
      socket.on(eventName, callback);
    } else {
      console.warn('Socket not initialized. Event will not be registered:', eventName);
    }
  }
  
  /**
   * Emit a typing event
   * @param {string} conversationId - The ID of the conversation
   */
  function emitTyping(conversationId) {
    if (socket && isSocketConnected) {
      socket.emit('typing', conversationId);
    }
  }
  
  /**
   * Emit a stop typing event
   * @param {string} conversationId - The ID of the conversation
   */
  function emitStopTyping(conversationId) {
    if (socket && isSocketConnected) {
      socket.emit('stopTyping', conversationId);
    }
  }

  /**
   * Loads all conversations for a specific user
   * @param {string} userId - The ID of the user
   * @returns {Promise} - Promise resolving to array of conversations
   */
  function loadUserConversations(userId) {
    return AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          return $q.reject(new Error('User not authenticated'));
        }
        
        return $http({
          method: 'GET',
          url: `${API_BASE_URL}/conversations`,
          withCredentials: true
        })
        .then(function(response) {
          const conversations = response.data.data;
          
          // Transform API response to match frontend format
          return conversations.map(function(conv) {
            // Find the other participant (not the current user)
            const otherParticipant = conv.participants.find(
              p => p && p.user && p.user._id && p.user._id !== currentUser._id
            );
            
            // Ensure we have valid data for the conversation
            const formattedConversation = {
              conversation_id: conv._id,
              sender_id: currentUser._id,
              receiver_id: otherParticipant ? otherParticipant.user._id : null,
              vehicle_id: conv.vehicle,
              vehicle: conv.vehicle_details || {},
              updated_at: conv.last_message ? conv.last_message.timestamp : conv.createdAt,
              isUnread: conv.unread_count && conv.unread_count[currentUser._id] > 0,
              last_message: conv.last_message ? conv.last_message.text : '',
              other_participant: otherParticipant || {},
              vehicleName: conv.vehicle_details ? conv.vehicle_details.title : 'Unknown Vehicle',
              otherUserName: otherParticipant ? otherParticipant.name : 'Car Owner'
            };

            console.log('Formatted conversation:', formattedConversation);
            return formattedConversation;
          });
        })
        .catch(function(error) {
          console.error('Failed to fetch conversations from API:', error);
          return $q.reject(error);
        });
      })
      .catch(function(error) {
        console.error('Error getting logged in user:', error);
        return $q.reject(error);
      });
  }

  /**
   * Marks a conversation as read
   * @param {string} conversationId - The ID of the conversation
   * @returns {Promise} - Promise resolving when update is complete
   */
  function markConversationAsRead(conversationId) {
    return AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          return $q.reject(new Error('User not authenticated'));
        }
        
        return $http({
          method: 'POST',
          url: `${API_BASE_URL}/conversations/${conversationId}/read`,
          withCredentials: true
        })
        .then(function() {
          // Also mark as read using socket for real-time notification
          if (socket && isSocketConnected) {
            socket.emit('markAsRead', conversationId);
          }
        })
        .catch(function(error) {
          console.error('Failed to mark conversation as read in API:', error);
          return $q.reject(error);
        });
      })
      .catch(function(error) {
        console.error('Error getting logged in user:', error);
        return $q.reject(error);
      });
  }

  /**
   * Gets a specific conversation by ID
   * @param {string} conversationId - The ID of the conversation
   * @returns {Promise} - Promise resolving to conversation object
   */
  function getConversationById(conversationId) {
    return AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          return $q.reject(new Error('User not authenticated'));
        }
        
        return $http({
          method: 'GET',
          url: `${API_BASE_URL}/conversations/${conversationId}`,
          withCredentials: true
        })
        .then(function(response) {
          const conversation = response.data.data;
          if (!conversation) {
            throw new Error('Conversation not found');
          }
          
          // Format the conversation data
          const otherParticipant = conversation.participants.find(
            p => p && p.user && p.user._id && p.user._id !== currentUser._id
          );
          
          return {
            conversation_id: conversation._id,
            sender_id: currentUser._id,
            receiver_id: otherParticipant ? otherParticipant.user._id : null,
            vehicle_id: conversation.vehicle,
            vehicle: conversation.vehicle_details || {},
            updated_at: conversation.last_message ? conversation.last_message.timestamp : conversation.createdAt,
            isUnread: conversation.unread_count && conversation.unread_count[currentUser._id] > 0,
            last_message: conversation.last_message ? conversation.last_message.text : '',
            other_participant: otherParticipant || {},
            vehicleName: conversation.vehicle_details ? conversation.vehicle_details.title : 'Unknown Vehicle',
            otherUserName: otherParticipant ? otherParticipant.name : 'Car Owner'
          };
        })
        .catch(function(error) {
          console.error('Failed to fetch conversation from API:', error);
          return $q.reject(error);
        });
      })
      .catch(function(error) {
        console.error('Error getting logged in user:', error);
        return $q.reject(error);
      });
  }

  /**
   * Loads all messages for a specific conversation
   * @param {string} conversationId - The ID of the conversation
   * @returns {Promise} - Promise resolving to array of messages
   */
  function loadMessagesByConversation(conversationId) {
    return AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          return $q.reject(new Error('User not authenticated'));
        }
        
        return $http({
          method: 'GET',
          url: `${API_BASE_URL}/conversations/${conversationId}/messages`,
          withCredentials: true
        })
        .then(function(response) {
          const messages = response.data.data;
          return messages.map(function(msg) {
            return {
              message_id: msg._id,
              conversation_id: msg.conversation,
              sender_id: msg.sender,
              content: msg.text,
              timestamp: new Date(msg.createdAt).toISOString(),
              attachment_url: msg.attachments && msg.attachments.length > 0 ? 
                msg.attachments[0].url : null
            };
          });
        })
        .catch(function(error) {
          console.error('Failed to fetch messages from API:', error);
          return $q.reject(error);
        });
      })
      .catch(function(error) {
        console.error('Error getting logged in user:', error);
        return $q.reject(error);
      });
  }

  /**
   * Sends a message in a conversation
   * @param {string} conversationId - The ID of the conversation
   * @param {string} text - Message text content
   * @param {File} attachmentFile - Optional file attachment
   * @returns {Promise} - Promise resolving when message is sent
   */
  function sendMessage(conversationId, text, attachmentFile) {
    return $q(function(resolve, reject) {
      if (!text && !attachmentFile) {
        reject(new Error("Message or attachment required"));
        return;
      }

      AuthService.getLoggedInUser()
        .then(function(currentUser) {
          if (!currentUser || !currentUser._id) {
            console.error('User not authenticated');
            return $q.reject(new Error('User not authenticated'));
          }
          
          // Try to use Socket.IO for real-time messaging
          if (socket && isSocketConnected) {
            return fileToBase64(attachmentFile)
              .then(function(attachmentObj) {
                // Emit message through socket
                socket.emit('sendMessage', {
                  conversationId: conversationId,
                  text: text || '',
                  attachment: attachmentObj ? attachmentObj.data : null
                });
                
                // The socket will receive the message back through the newMessage event
                // and update the local storage, so we don't need to do it here
                resolve();
              })
              .catch(function(error) {
                console.error('Error converting attachment:', error);
                reject(error);
              });
          }
          
          // Fallback to HTTP API if socket is not connected
          return fileToBase64(attachmentFile)
            .then(function(attachmentObj) {
              return $http({
                method: 'POST',
                url: `${API_BASE_URL}/messages`,
                withCredentials: true,
                data: {
                  conversation_id: conversationId,
                  content: text || '',
                  attachment: attachmentObj ? attachmentObj.data : null
                }
              });
            })
            .then(function(response) {
              resolve(response.data.data);
            })
            .catch(function(error) {
              console.error('Failed to send message via API:', error);
              reject(error);
            });
        })
        .catch(function(error) {
          console.error('Error getting logged in user:', error);
          reject(error);
        });
    });
  }

  /**
   * Creates a new conversation if one doesn't already exist
   * @param {string} vehicleId - The ID of the vehicle
   * @param {string} senderId - The ID of the sender
   * @param {string} receiverId - The ID of the receiver
   * @returns {Promise} - Promise resolving to the conversation ID
   */
  function createConversationIfNotExists(vehicleId, senderId, receiverId) {
    return AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          return $q.reject(new Error('User not authenticated'));
        }

        // Ensure IDs are properly formatted (strings, not objects)
        const safeVehicleId = vehicleId && vehicleId._id ? vehicleId._id : vehicleId;
        const safeReceiverId = receiverId && receiverId._id ? receiverId._id : receiverId;
        
        console.log('Creating conversation with cleaned IDs:', {
          vehicleId: safeVehicleId,
          participant_id: safeReceiverId
        });
        
        // Try to create/get conversation from API
        return $http({
          method: 'POST',
          url: `${API_BASE_URL}/conversations`,
          withCredentials: true,
          data: {
            participant_id: safeReceiverId,
            vehicle_id: safeVehicleId
          }
        })
        .then(function(response) {
          const conversation = response.data.data;
          
          // Transform and store in local DB
          const formattedConv = {
            conversation_id: conversation._id,
            sender_id: senderId,
            receiver_id: safeReceiverId,
            vehicle_id: safeVehicleId,
            vehicle: conversation.vehicle_details || {},
            updated_at: new Date().toISOString(),
            isUnread: false
          };
          
          DbService.addRecord('conversations', formattedConv).catch(console.error);
          
          return conversation._id;
        })
        .catch(function(error) {
          console.error('Failed to create conversation via API:', error);
          return $q.reject(error);
        });
      })
      .catch(function(error) {
        console.error('Error getting logged in user:', error);
        return $q.reject(error);
      });
  }

  /**
   * Converts a file to base64 encoding
   * @param {File} file - The file to convert
   * @returns {Promise} - Promise resolving to file data object
   */
  function fileToBase64(file) {
    if (!file) {
      return $q.resolve(null);
    }
    
    return $q(function(resolve, reject) {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        resolve({
          data: e.target.result,
          type: file.type,
          name: file.name,
          size: file.size
        });
      };
      
      reader.onerror = function(e) {
        reject(e);
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Creates a new conversation
   * @param {Object} data - Conversation data containing vehicleId, sellerId, and buyerId
   * @returns {Promise} - Promise resolving with the created conversation
   */
  function createConversation(data) {
    return $q(function(resolve, reject) {
      // Get the current user using promise
      AuthService.getLoggedInUser()
        .then(function(currentUser) {
          console.log('Current user in createConversation:', currentUser);
          
          if (!currentUser || !currentUser._id) {
            throw new Error('User must be logged in to create a conversation');
          }
          
          // Ensure IDs are properly formatted (strings, not objects)
          const safeVehicleId = data.vehicleId && data.vehicleId._id ? data.vehicleId._id : data.vehicleId;
          const safeSellerId = data.sellerId && data.sellerId._id ? data.sellerId._id : data.sellerId;
          
          console.log('Creating conversation with data:', {
            vehicleId: safeVehicleId,
            sellerId: safeSellerId
          });
          
          // Create conversation via API
          return $http({
            method: 'POST',
            url: `${API_BASE_URL}/conversations`,
            withCredentials: true,
            data: {
              participant_id: safeSellerId,
              vehicle_id: safeVehicleId
            }
          });
        })
        .then(function(response) {
          console.log('API response for conversation creation:', response.data);
          
          if (!response.data) {
            throw new Error('Invalid response from server');
          }
          
          // Handle both new conversation and existing conversation responses
          const conversation = response.data.data || response.data;
          if (!conversation || !conversation._id) {
            throw new Error('Invalid conversation data in response');
          }
          
          // Get the current user again to make sure we have the latest data
          return AuthService.getLoggedInUser().then(function(currentUser) {
            // Format conversation for frontend
            const formattedConversation = {
              conversation_id: conversation._id,
              sender_id: currentUser._id,
              receiver_id: data.sellerId,
              vehicle_id: conversation.vehicle,
              vehicle: conversation.vehicle_details || {},
              updated_at: conversation.updatedAt || conversation.createdAt,
              isUnread: false,
              last_message: null,
              other_participant: conversation.participants.find(p => p.user._id !== currentUser._id)
            };
            
            // Join the conversation room
            if (socket && isSocketConnected) {
              console.log('Joining conversation room:', conversation._id);
              socket.emit('joinConversation', conversation._id);
            }
            
            return formattedConversation;
          });
        })
        .then(function(formattedConversation) {
          resolve(formattedConversation);
        })
        .catch(function(error) {
          console.error('Error creating conversation:', error);
          reject(error);
        });
    });
  }
}
