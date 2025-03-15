'use strict';

angular
  .module('carRentalApp')
  .controller('ConversationsController', ConversationsController);

ConversationsController.$inject = [
  '$state', '$scope', 'AuthService', 'MessagingService', 'DbService', '$window', '$q'
];

function ConversationsController($state, $scope, AuthService, MessagingService, DbService, $window, $q) {
  // Controller variables - organized at top
  const vm = this;
  
  // Data properties
  vm.conversations = [];
  vm.loading = false;
  
  // Method bindings
  vm.init = init;
  vm.openChat = openChat;
  vm.goBack = function() {
    $window.history.go(-2);
  };


  /**
   * Initializes the controller and loads conversations
   * Fetches conversations and enriches them with vehicle and user details
   */
  function init() {
    const currentUser = AuthService.getLoggedInUser();
    if (!currentUser) {
      alert("Please log in.");
      $state.go('login');
      return;
    }

    vm.loading = true;


    const vehiclesCache = {};
    const usersCache = {};

    MessagingService.loadUserConversations(currentUser.user_id)
      .then(function(convs) {
        const convsPromises = convs.map(function(conv) {
          const otherPartyId = (conv.sender_id.toString() === currentUser.user_id.toString())? conv.receiver_id:conv.sender_id;


          const vehiclePromise = vehiclesCache[conv.vehicle_id] 
            ? $q.when(vehiclesCache[conv.vehicle_id])
            : DbService.getRecord('vehicles', conv.vehicle_id).then(function(vehicle) {
                vehiclesCache[conv.vehicle_id] = vehicle;
                return vehicle;
              });

          const userPromise = usersCache[otherPartyId]
            ? $q.when(usersCache[otherPartyId])
            : DbService.getRecord('users', otherPartyId).then(function(user) {
                usersCache[otherPartyId] = user;
                return user;
              });

          return $q.all([vehiclePromise, userPromise])
            .then(function(results) {
              const vehicle = results[0];
              const otherUser = results[1];
              conv.vehicleName = vehicle 
                ? (vehicle.vehicleModel || vehicle.name || 'Unknown Vehicle')
                : 'Unknown Vehicle';
              if (conv.vehicle && conv.vehicle.name) {
                conv.vehicleName = conv.vehicle.name;
              }
              conv.otherUserName = otherUser 
                ? (otherUser.username || otherUser.first_name || 'Unknown User')
                : 'Unknown User';
              return conv;
            });
        });

        return $q.all(convsPromises);
      })
      .then(function(convsWithDetails) {
        console.log("Final conversations with details:", convsWithDetails);
        vm.conversations = convsWithDetails;
      })
      .catch(function(err) {
        console.error("Error fetching conversations:", err);
        alert("Error loading conversations");
      })
      .finally(function() {
        vm.loading = false;
      });
  }

  /**
   * Opens the chat window for a specific conversation
   * Marks the conversation as read before navigating
   * @param {Object} conversation - The conversation to open
   */
  function openChat(conversation) {
    MessagingService.markConversationAsRead(conversation.conversation_id)
      .finally(function() {
        $state.go('chat', { conversationId: conversation.conversation_id });
      });
  }
}
