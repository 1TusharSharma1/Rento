'use strict';

angular
  .module('carRentalApp')
  .controller('ConversationsController', ConversationsController);

ConversationsController.$inject = [
  '$state', '$scope', 'AuthService', 'MessagingService', 'DbService', '$window', '$q', '$timeout'
];

function ConversationsController($state, $scope, AuthService, MessagingService, DbService, $window, $q, $timeout) {
  // Controller variables - organized at top
  const vm = this;
  
  // Data properties
  vm.conversations = [];
  vm.loading = false;
  vm.errorMessage = '';
  
  // Method bindings
  vm.init = init;
  vm.openChat = openChat;
  vm.getUserInitials = getUserInitials;
  vm.goBack = function() {
    $window.history.go(-2);
  };

  /**
   * Gets user initials from the name for avatar display
   * @param {string} name - User name
   * @returns {string} - First two initials or default placeholder
   */
  function getUserInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Initializes the controller and loads conversations
   * Fetches conversations and enriches them with vehicle and user details
   */
  function init() {
    AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          console.error('User not authenticated');
          $state.go('login');
          return;
        }

        vm.loading = true;

        console.log('Loading conversations for user:', currentUser);

        return MessagingService.loadUserConversations(currentUser._id)
          .then(function(conversations) {
            console.log("Conversations loaded:", conversations);
            if (!conversations || !Array.isArray(conversations)) {
              console.error("Invalid conversations data:", conversations);
              vm.conversations = [];
              return;
            }
            
            // Process conversations to make sure they have proper user names
            vm.conversations = conversations.map(function(conv) {
              // Ensure the conversation has a proper otherUserName
              if (!conv.otherUserName || conv.otherUserName === 'Car Owner') {
                // Try to get the name from other participant object
                if (conv.other_participant && conv.other_participant.user) {
                  // Get the name from the participant object
                  if (conv.other_participant.name) {
                    conv.otherUserName = conv.other_participant.name;
                  } else if (conv.other_participant.user.name) {
                    conv.otherUserName = conv.other_participant.user.name;
                  }
                }
              }
              
              // Format the vehicle name if it's missing
              if (!conv.vehicleName && conv.vehicle && conv.vehicle.title) {
                conv.vehicleName = conv.vehicle.title;
              }
              
              return conv;
            });
          })
          .catch(function(err) {
            console.error("Error fetching conversations:", err);
            vm.conversations = [];
            vm.errorMessage = "Error loading conversations";
          })
          .finally(function() {
            vm.loading = false;
          });
      })
      .catch(function(error) {
        console.error('Error checking authentication:', error);
        $state.go('login');
      });
  }

  /**
   * Opens the chat window for a specific conversation
   * Marks the conversation as read before navigating
   * @param {Object} conversation - The conversation to open
   */
  function openChat(conversation) {
    if (!conversation || !conversation.conversation_id) {
      console.error("Invalid conversation object:", conversation);
      return;
    }

    console.log('Opening chat for conversation:', conversation);
    
    // Navigate to chat first, then mark as read
    $state.go('chat', { conversationId: conversation.conversation_id });
  }
}
