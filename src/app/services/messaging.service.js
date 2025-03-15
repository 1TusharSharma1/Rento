
    'use strict';
  
    angular
      .module('carRentalApp')
      .service('MessagingService', MessagingService);
  
    MessagingService.$inject = ['$q', 'DbService', 'AuthService'];
  
    function MessagingService($q, DbService, AuthService) {

      const service = {
        loadUserConversations: loadUserConversations,
        markConversationAsRead: markConversationAsRead,
        getConversationById: getConversationById,
        loadMessagesByConversation: loadMessagesByConversation,
        sendMessage: sendMessage,
        createConversationIfNotExists: createConversationIfNotExists
      };
      
      return service;
  
      /**
       * Loads all conversations for a specific user
       * @param {string} userId - The ID of the user
       * @returns {Promise} - Promise resolving to array of conversations
       */
      function loadUserConversations(userId) {
        return DbService.getStore('conversations', 'readonly')
          .then(function(store) {
            return $q(function(resolve, reject) {
              const request = store.getAll();
              
              request.onsuccess = function(e) {
                let conversations = e.target.result || [];
                conversations = conversations.filter(function(conv) {
                  return (conv.sender_id && conv.sender_id.toString() === userId.toString()) ||
                         (conv.receiver_id && conv.receiver_id.toString() === userId.toString());
                });
                conversations.sort(function(a, b) {
                  return new Date(b.updated_at) - new Date(a.updated_at);
                });
                resolve(conversations);
              };
              
              request.onerror = reject;
            });
          });
      }
  
      /**
       * Marks a conversation as read
       * @param {string} conversationId - The ID of the conversation
       * @returns {Promise} - Promise resolving when update is complete
       */
      function markConversationAsRead(conversationId) {
        const deferred = $q.defer();
        
        DbService.getRecord('conversations', conversationId)
          .then(function(conv) {
            if (!conv) {
              return deferred.resolve();
            }
            if (conv.isUnread) {
              conv.isUnread = false;
              conv.updated_at = new Date().toISOString();
              return DbService.updateRecord('conversations', conv);
            }
          })
          .then(function() {
            deferred.resolve();
          })
          .catch(function(err) {
            deferred.reject(err);
          });
        return deferred.promise;
      }
  
      /**
       * Gets a specific conversation by ID
       * @param {string} conversationId - The ID of the conversation
       * @returns {Promise} - Promise resolving to conversation object
       */
      function getConversationById(conversationId) {
        return DbService.getRecord('conversations', conversationId);
      }
  
      /**
       * Loads all messages for a specific conversation
       * @param {string} conversationId - The ID of the conversation
       * @returns {Promise} - Promise resolving to array of messages
       */
      function loadMessagesByConversation(conversationId) {
        const deferred = $q.defer();
  
        DbService.getStore('messages', 'readonly')
          .then(function(store) {
            const request = store.getAll();
            
            request.onsuccess = function(e) {
              let messages = e.target.result || [];
              messages = messages.filter(function(message) {
                return message.conversation_id === conversationId;
              });
              // Sort messages by timestamp (oldest first)
              messages.sort(function(a, b) {
                return new Date(a.timestamp) - new Date(b.timestamp);
              });
              deferred.resolve(messages);
            };
            
            request.onerror = function(e) {
              deferred.reject(e.target.error);
            };
          })
          .catch(function(err) {
            deferred.reject(err);
          });
  
        return deferred.promise;
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
  
          const currentUser = AuthService.getLoggedInUser();
          if (!currentUser) {
            reject(new Error("User not authenticated"));
            return;
          }
  
          // Get the conversation to determine receiver and vehicle_id
          DbService.getRecord('conversations', conversationId)
            .then(function(conversation) {
              if (!conversation) {
                throw new Error("Conversation not found");
              }
              
              const receiverId = conversation.sender_id === currentUser.user_id ? 
                conversation.receiver_id : conversation.sender_id;
                
              return fileToBase64(attachmentFile)
                .then(function(attachmentObj) {
                  const messageId = crypto.randomUUID();
                  const message = {
                    message_id: messageId,
                    conversation_id: conversationId,
                    sender_id: currentUser.user_id,
                    receiver_id: receiverId,
                    vehicle_id: conversation.vehicle_id,
                    content: text || '',
                    timestamp: new Date().toISOString(),
                    attachment_url: attachmentObj.data, 
                    status: "sent"
                  };
                  
                  conversation.isUnread = true;
                  conversation.updated_at = message.timestamp;
                  
                  return $q.all([
                    DbService.addRecord('messages', message),
                    DbService.updateRecord('conversations', conversation)
                  ]);
                });
            })
            .then(function() {
              resolve();
            })
            .catch(function(err) {
              reject(err);
            });
        });
      }
  
      /**
       * Creates a new conversation if one doesn't already exist
       * @param {string} conversationId - The ID for the new conversation
       * @param {string} senderId - The ID of the sender
       * @param {string} receiverId - The ID of the receiver
       * @param {string} vehicleId - The ID of the vehicle
       * @returns {Promise} - Promise resolving when conversation is created
       */
      function createConversationIfNotExists(conversationId, senderId, receiverId, vehicleId) {
        return DbService.getRecord('vehicles', vehicleId)
          .then(function(vehicle) {
            if (!vehicle) {
              throw new Error("Vehicle not found");
            }
  
            return DbService.getRecord('conversations', conversationId)
              .then(function(existing) {
                if (existing) return null;
  
                const conversationRecord = {
                  conversation_id: conversationId,
                  sender_id: senderId,
                  receiver_id: receiverId,
                  vehicle_id: vehicleId,
                  vehicle: {
                    vehicle_id: vehicle.vehicle_id,
                    name: vehicle.vehicleModel,
                    model: vehicle.vehicleModel,
                    photo: Array.isArray(vehicle.images_URL) ? vehicle.images_URL[0] : ''
                  },
                  updated_at: new Date().toISOString(),
                  isUnread: true
                };
                return DbService.addRecord('conversations', conversationRecord);
              });
          });
      }
  
      /**
       * Converts a file to base64 encoding
       * @param {File} file - The file to convert
       * @returns {Promise} - Promise resolving to file data object
       */
      function fileToBase64(file) {
        return $q(function(resolve, reject) {
          if (!file) {
            resolve({ data: '', type: '', name: '', size: 0 });
            return;
          }
          
          const reader = new FileReader();
          reader.readAsDataURL(file);
  
          reader.onload = function() {
            resolve({
              data: reader.result,
              type: file.type,
              name: file.name,
              size: file.size
            });
          };
  
          reader.onerror = function(error) {
            reject(error);
          };
        });
      }
    }
