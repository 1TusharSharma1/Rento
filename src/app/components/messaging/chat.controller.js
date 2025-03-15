
    'use strict';
  
    angular
      .module('carRentalApp')
      .controller('ChatController', ChatController);
  
    ChatController.$inject = ['$stateParams', '$state', 'AuthService', 'MessagingService', 'DbService', '$q', '$scope'];
  
    function ChatController($stateParams, $state, AuthService, MessagingService, DbService, $q, $scope) {
      const vm = this;
      vm.messages = [];         // All chat messages
      vm.conversation = null;   // Current conversation data
      vm.newMessage = '';       // Message being composed
      vm.attachmentFile = null; // Selected attachment file
      vm.chatHeader = '';       // Header text with vehicle and user info
      vm.loading = false;       // Loading state flag
      vm.currentUser = null;    // Current logged-in user
      vm.init = init;
      vm.send = send;
      vm.handleFileSelect = handleFileSelect;
      vm.removeAttachment = removeAttachment;
      vm.getFileIcon = getFileIcon;
      vm.downloadAttachment = downloadAttachment;
  
      function init() {
        const currentUser = AuthService.getLoggedInUser();
        if (!currentUser) {
          alert("Please log in.");
          return $state.go('login');
        }
        
        vm.currentUser = currentUser;
        const conversationId = $stateParams.conversationId;
        if (!conversationId) {
          alert("Invalid conversation parameters.");
          return $state.go('conversations');
        }
    
        vm.loading = true;
    
        return $q.all([
          MessagingService.getConversationById(conversationId),
          MessagingService.loadMessagesByConversation(conversationId)
        ])
        .then(function(results) {
          const conversation = results[0];
          const messages = results[1];
    
          if (!conversation) {
            alert("Conversation not found!");
            return $state.go('conversations');
          }
    
          vm.conversation = conversation;
          vm.messages = messages;
    
          return $q.all([
            MessagingService.markConversationAsRead(conversationId),
            buildChatHeader(conversation).then(function(header) {
              vm.chatHeader = header;
            })
          ]);
        })
        .catch(function(err) {
          console.error("Error loading conversation or messages:", err);
          alert("Error loading conversation");
        })
        .finally(function() {
          vm.loading = false;
        });
      }
    
      // Send message with optional attachment
      function send() {
        if (!vm.newMessage && !vm.attachmentFile) {
          return $q.when();
        }
        
        return MessagingService.sendMessage(
          vm.conversation.conversation_id,
          vm.newMessage.trim(),
          vm.attachmentFile
        )
        .then(function() {
          vm.newMessage = '';
          vm.attachmentFile = null;
          document.getElementById('attachmentInput').value = '';
    
          return MessagingService.loadMessagesByConversation(vm.conversation.conversation_id);
        })
        .then(function(messages) {
          vm.messages = messages;
        })
        .catch(function(err) {
          console.error("Error sending message:", err);
          alert(err.message || "Failed to send message");
        });
      }
    
      // Build header with vehicle and user information
      function buildChatHeader(conversation) {
        if (!conversation || !conversation.vehicle_id) {
          console.error('Invalid conversation:', conversation);
          return $q.when('Chat');
        }
    
        const currentUser = AuthService.getLoggedInUser();
        if (!currentUser) {
          return $q.when('Chat');
        }
    
        const otherPartyId = conversation.sender_id === currentUser.user_id ? 
          conversation.receiver_id : conversation.sender_id;
    
        if (!otherPartyId) {
          return $q.when('Chat');
        }
    
        return $q.all([
          DbService.getRecord('vehicles', conversation.vehicle_id),
          DbService.getRecord('users', otherPartyId)
        ])
        .then(function(results) {
          const vehicle = results[0];
          const otherUser = results[1];
    
          const vehicleName = vehicle ? (vehicle.vehicleModel || 'Unknown Vehicle') : 'Unknown Vehicle';
          const otherUserName = otherUser ? (otherUser.username || otherUser.first_name || 'Unknown User') : 'Unknown User';
    
          return `${vehicleName} — Chat with ${otherUserName}`;
        })
        .catch(function(err) {
          console.error("Error building chat header:", err);
          return 'Chat';
        });
      }
  
      function handleFileSelect(files) {
        if (files && files[0]) {
          if (files[0].size > 5 * 1024 * 1024) { 
            alert('Image size must be less than 5MB');
            document.getElementById('attachmentInput').value = '';
            return $q.reject('File too large');
          }
          if (!files[0].type.startsWith('image/')) {
            alert('Only image files are allowed');
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
    }
