    'use strict';
  
    angular
      .module('carRentalApp')
      .controller('ChatController', ChatController);
  
    ChatController.$inject = ['$stateParams', '$state', 'AuthService', 'MessagingService', 'DbService', '$q', '$scope', '$timeout'];
  
    function ChatController($stateParams, $state, AuthService, MessagingService, DbService, $q, $scope, $timeout) {
      const vm = this;
      vm.messages = [];         // All chat messages
      vm.conversation = null;   // Current conversation data
      vm.newMessage = '';       // Message being composed
      vm.attachmentFile = null; // Selected attachment file
      vm.chatHeader = '';       // Header text with vehicle and user info
      vm.loading = true;        // Loading state flag
      vm.currentUser = null;    // Current logged-in user
      vm.otherUserTyping = false; // Whether the other user is typing
      vm.socketConnected = false; // Whether socket is connected
      vm.errorMessage = null;    // Error message
      vm.isSending = false;      // Whether the message is being sent
      
      // UI methods
      vm.init = init;
      vm.send = sendMessage;
      vm.handleFileSelect = handleFileSelect;
      vm.removeAttachment = removeAttachment;
      vm.getFileIcon = getFileIcon;
      vm.downloadAttachment = downloadAttachment;
      vm.onInputFocus = onInputFocus;
      vm.onInputBlur = onInputBlur;
      vm.handleTyping = handleTyping;
      vm.getOtherUserName = getOtherUserName;
      
      // User typing timer
      let typingTimer;
      const TYPING_TIMER_LENGTH = 3000; // 3 seconds
  
      function init() {
        // First check if user is logged in
        AuthService.getLoggedInUser()
          .then(function(currentUser) {
            if (!currentUser || !currentUser._id) {
              vm.errorMessage = "Please log in to access chat";
              $state.go('login');
              return;
            }
            
            vm.currentUser = currentUser;
            const conversationId = $stateParams.conversationId;
            
            if (!conversationId) {
              vm.errorMessage = "Invalid conversation";
              $state.go('conversations');
              return;
            }
        
            vm.loading = true;
            
            // Initialize socket first
            return MessagingService.initSocket()
              .then(function() {
                vm.socketConnected = true;
                // Setup socket event handlers
                setupSocketEventHandlers();
                // Join the conversation room
                MessagingService.joinConversation(conversationId);
                // Then load conversation
                return loadConversation(conversationId);
              })
              .then(function() {
                vm.loading = false;
              })
              .catch(function(error) {
                console.error('Error initializing chat:', error);
                vm.errorMessage = error.message || "Failed to initialize chat";
                vm.loading = false;
                // If conversation not found, redirect to conversations list
                if (error.status === 404) {
                  $state.go('conversations');
                }
              });
          })
          .catch(function(error) {
            console.error('Error checking authentication:', error);
            vm.errorMessage = "Please log in to access chat";
            $state.go('login');
          });
      }
      
      // Setup socket event handlers
      function setupSocketEventHandlers() {
        // Handle new messages
        MessagingService.on('newMessage', function(message) {
          // Only process messages for the current conversation
          if (vm.conversation && message.conversation === vm.conversation.conversation_id) {
            // Format the message for the UI
            const formattedMessage = {
              message_id: message._id,
              conversation_id: message.conversation,
              sender_id: message.sender,
              content: message.text,
              timestamp: new Date(message.createdAt).toISOString(),
              attachment_url: message.attachments && message.attachments.length > 0 ? 
                message.attachments[0].url : null
            };
            
            // Use $timeout instead of $apply to safely update the UI
            $timeout(function() {
              vm.messages.push(formattedMessage);
              // Auto-scroll to bottom
              setTimeout(function() {
                const chatContainer = document.querySelector('.chat-messages');
                if (chatContainer) {
                  chatContainer.scrollTop = chatContainer.scrollHeight;
                }
              }, 0);
            });
            
            // Mark as read if we're actively in this conversation
            MessagingService.markConversationAsRead(vm.conversation.conversation_id);
          }
        });
        
        // Handle typing indicators
        MessagingService.on('userTyping', function(data) {
          if (vm.conversation && data.conversationId === vm.conversation.conversation_id 
              && data.userId !== vm.currentUser._id) {
            $timeout(function() {
              vm.otherUserTyping = true;
            });
            
            // Clear any existing timer
            if (typingTimer) {
              clearTimeout(typingTimer);
            }
            
            // Set a timer to clear the typing indicator
            typingTimer = setTimeout(function() {
              $timeout(function() {
                vm.otherUserTyping = false;
              });
            }, TYPING_TIMER_LENGTH);
          }
        });
        
        MessagingService.on('userStoppedTyping', function(data) {
          if (vm.conversation && data.conversationId === vm.conversation.conversation_id 
              && data.userId !== vm.currentUser._id) {
            $timeout(function() {
              vm.otherUserTyping = false;
            });
            
            if (typingTimer) {
              clearTimeout(typingTimer);
            }
          }
        });
        
        // Handle messages being read
        MessagingService.on('messagesRead', function(data) {
          if (vm.conversation && data.conversationId === vm.conversation.conversation_id) {
            // Could update UI to show messages have been read
            console.log('Messages marked as read by:', data.userId);
          }
        });
      }
      
      function loadConversation(conversationId) {
        return MessagingService.getConversationById(conversationId)
          .then(function(conversation) {
            if (!conversation) {
              throw new Error("Conversation not found");
            }
            vm.conversation = conversation;
            return loadMessages(conversationId);
          })
          .catch(function(error) {
            console.error('Error loading conversation:', error);
            vm.errorMessage = "Failed to load conversation";
            throw error;
          });
      }
  
      function loadMessages(conversationId) {
        return MessagingService.loadMessagesByConversation(conversationId)
          .then(function(messages) {
            vm.messages = messages;
            // Build chat header after messages are loaded
            return buildChatHeader(vm.conversation);
          })
          .then(function(header) {
            vm.chatHeader = header;
            // Auto-scroll to bottom after messages load
            setTimeout(function() {
              const chatContainer = document.querySelector('.chat-messages');
              if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
              }
            }, 0);
          })
          .catch(function(error) {
            console.error('Error loading messages:', error);
            vm.errorMessage = "Failed to load messages";
            throw error;
          });
      }
      
      // Send message with optional attachment
      function sendMessage() {
        if (!vm.conversation || !vm.conversation.conversation_id) {
          vm.errorMessage = "Cannot send message: Conversation not loaded";
          return;
        }
    
        if (!vm.newMessage && !vm.attachmentFile) return;
    
        vm.isSending = true;
        MessagingService.sendMessage(vm.conversation.conversation_id, vm.newMessage, vm.attachmentFile)
          .then(function() {
            vm.newMessage = '';
            vm.attachmentFile = null;
            vm.isSending = false;
          })
          .catch(function(error) {
            console.error('Error sending message:', error);
            vm.errorMessage = "Failed to send message";
            vm.isSending = false;
          });
      }
      
      // Handle typing indicator
      function handleTyping() {
        if (!vm.conversation || !vm.conversation.conversation_id) {
          return;
        }
    
        if (!vm.typingTimeout) {
          MessagingService.emitTyping(vm.conversation.conversation_id);
        }
    
        clearTimeout(vm.typingTimeout);
        vm.typingTimeout = setTimeout(function() {
          MessagingService.emitStopTyping(vm.conversation.conversation_id);
          vm.typingTimeout = null;
        }, 1000);
      }
      
      // Handle input focus (joined conversation)
      function onInputFocus() {
        if (vm.conversation && vm.conversation.conversation_id) {
          MessagingService.markConversationAsRead(vm.conversation.conversation_id);
        }
      }
      
      // Handle input blur (nothing special needed yet)
      function onInputBlur() {
        // Could implement additional functionality here if needed
      }
    
      // Build header with vehicle and user information
      function buildChatHeader(conversation) {
        if (!conversation || !conversation.vehicle_id) {
          console.error('Invalid conversation:', conversation);
          return $q.when('Chat');
        }
    
        return AuthService.getLoggedInUser()
          .then(function(currentUser) {
            if (!currentUser || !currentUser._id) {
              return 'Chat';
            }
        
            let otherPartyId;
            let otherUserName = '';
            
            // First try to get the other participant info directly from the conversation object
            if (conversation.other_participant) {
              if (conversation.other_participant.user) {
                if (typeof conversation.other_participant.user === 'object') {
                  otherPartyId = conversation.other_participant.user._id;
                  
                  // Get name from appropriate field
                  if (conversation.other_participant.name) {
                    otherUserName = conversation.other_participant.name;
                  } else if (conversation.other_participant.user.name) {
                    otherUserName = conversation.other_participant.user.name;
                  }
                } else {
                  otherPartyId = conversation.other_participant.user;
                  if (conversation.other_participant.name) {
                    otherUserName = conversation.other_participant.name;
                  }
                }
              }
            } 
            
            // If we couldn't get it from other_participant, try the standard way
            if (!otherPartyId) {
              otherPartyId = conversation.sender_id === currentUser._id ? 
                conversation.receiver_id : conversation.sender_id;
            }
        
            if (!otherPartyId) {
              return 'Chat';
            }
            
            // Use the vehicle name from the conversation if available
            let vehicleName = conversation.vehicleName || '';
            if (!vehicleName && conversation.vehicle && conversation.vehicle.title) {
              vehicleName = conversation.vehicle.title;
            }
        
            // If we already have the other user's name, we can return the chat header
            if (otherUserName) {
              return vehicleName ? 
                `${vehicleName} — Chat with ${otherUserName}` : 
                `Chat with ${otherUserName}`;
            }
            
            // Otherwise, fetch from DbService
            return $q.all([
              DbService.getRecord('vehicles', conversation.vehicle_id),
              DbService.getRecord('users', otherPartyId)
            ])
            .then(function(results) {
              const vehicle = results[0];
              const otherUser = results[1];
        
              vehicleName = vehicleName || (vehicle ? (vehicle.title || vehicle.vehicleModel || 'Unknown Vehicle') : 'Unknown Vehicle');
              otherUserName = "Car Owner";
        
              return `${vehicleName} — Chat with ${otherUserName}`;
            })
            .catch(function(err) {
              console.error("Error building chat header:", err);
              return vehicleName ? 
                `${vehicleName} — Chat` : 
                'Chat';
            });
          });
      }
  
      function handleFileSelect(files) {
        if (files && files[0]) {
          if (files[0].size > 5 * 1024 * 1024) { 
            vm.errorMessage = 'Image size must be less than 5MB';
            document.getElementById('attachmentInput').value = '';
            return $q.reject('File too large');
          }
          if (!files[0].type.startsWith('image/')) {
            vm.errorMessage = 'Only image files are allowed';
            document.getElementById('attachmentInput').value = '';
            return $q.reject('Invalid file type');
          }
          vm.attachmentFile = files[0];
          return $q.resolve(vm.attachmentFile);
        }
        return $q.resolve(null);
      }
  
      function removeAttachment() {
        vm.attachmentFile = null;
        document.getElementById('attachmentInput').value = '';
      }
  
      function getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '📷';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        return '📎';
      }
  
      function downloadAttachment(attachmentUrl) {
        const link = document.createElement('a');
        link.href = attachmentUrl;
        link.download = 'attachment';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Clean up when leaving the page
      $scope.$on('$destroy', function() {
        if (vm.conversation && vm.conversation.conversation_id) {
          MessagingService.leaveConversation(vm.conversation.conversation_id);
        }
        if (vm.typingTimeout) {
          clearTimeout(vm.typingTimeout);
        }
        if (typingTimer) {
          clearTimeout(typingTimer);
        }
      });

      /**
       * Gets the name of the other user in the conversation
       * @returns {string} - Name of the other user or default text
       */
      function getOtherUserName() {
        if (!vm.conversation) return 'Someone';

        // Extract user name from appropriate places in the conversation object
        if (vm.conversation.otherUserName) {
          return vm.conversation.otherUserName;
        }
        
        if (vm.conversation.other_participant) {
          if (vm.conversation.other_participant.name) {
            return vm.conversation.other_participant.name;
          }
          
          if (vm.conversation.other_participant.user && 
              typeof vm.conversation.other_participant.user === 'object' && 
              vm.conversation.other_participant.user.name) {
            return vm.conversation.other_participant.user.name;
          }
        }
        
        return 'Someone';
      }
    }
