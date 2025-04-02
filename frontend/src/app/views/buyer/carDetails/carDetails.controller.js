'use strict';

angular
  .module('carRentalApp')
  .controller('CarDetailsController', CarDetailsController);

CarDetailsController.$inject = [
  '$stateParams',
  '$state',
  '$timeout',
  '$scope',
  'AuthService',
  'DbService',
  'BiddingService',
  '$uibModal',
  'MessagingService',
  '$rootScope',
  'BiddingFactory',
  '$q'
];

function CarDetailsController($stateParams, $state, $timeout, $scope, AuthService, DbService, BiddingService, $uibModal, MessagingService, $rootScope, BiddingFactory, $q) {
  const vm = this;

  // Data models and defaults
  vm.car = {};
  vm.carImages = [];
  vm.activeSlide = 0;
  vm.highestBid = null;
  vm.isUserHasGovtId = false;
  vm.today = new Date();

  vm.bidData = {
    bidAmount: null,
    vehicleId: null,
    bidStartDate: '',
    bidEndDate: '',
    govtId: '',
    bidMessage: '',
    isOutstation: false,
    minPrice: 0,
    minPriceOutstation: 0
  };

  // Public methods
  vm.init = init;
  vm.openBidModal = openBidModal;
  vm.closeBidModal = closeBidModal;
  vm.updateMinBidDisplay = updateMinBidDisplay;
  vm.placeBid = placeBid;
  vm.startChat = startChat;

  /**
   * Initializes the car details view.
   * @function init
   */
  function init() {
    const carId = $stateParams.carId;
    console.log('Initializing car details with ID:', carId);
    
    if (!carId) {
      console.error('No car ID provided');
      vm.errorMessage = "Invalid car selection. Please go back and try again.";
      return;
    }
    
    async.waterfall([
      /**
       * Retrieves the car record.
       * @param {Function} callback - Callback to pass the car data.
       */
      function(callback) {
        DbService.getRecord('vehicles', carId)
          .then(function(carData) {
            if (!carData) {
              console.error('Car not found with ID:', carId);
              return callback("Car not found");
            }
            console.log('Car data retrieved:', carData);
            callback(null, carData);
          })
          .catch(function(error) {
            console.error('Error fetching car data:', error);
            callback(error);
          });
      },
      /**
       * Sets the car data, images, and bid defaults.
       * @param {Object} carData - The car record.
       * @param {Function} callback - Callback to pass the highest bid.
       */
      function(carData, callback) {
        vm.car = carData;
        console.log('Raw car data:', JSON.stringify(carData));
        vm.car.vehicle_id = vm.car.vehicle_id || vm.car._id;
        
        // Ensure seller_id is properly set from owner field
        if (!vm.car.seller_id && vm.car.owner) {
          console.log('Using owner as seller_id:', vm.car.owner);
          vm.car.seller_id = vm.car.owner;
        }
        
        if (!vm.car.vehicle_id) {
          console.error('Failed to determine vehicle ID from car data');
        } else {
          console.log('Using vehicle_id:', vm.car.vehicle_id);
        }
        
        if (!vm.car.seller_id) {
          console.error('Failed to determine seller ID from car data');
        } else {
          console.log('Using seller_id:', vm.car.seller_id);
        }
        if (carData.images) {
          console.log('Found images field:', carData.images);
          vm.carImages = carData.images;
        } else if (carData.images_URL) {
          console.log('Found images_URL field:', carData.images_URL);
          vm.carImages = carData.images_URL;
        } else {
          console.warn('No images found for this car');
          vm.carImages = [];
        }
        
        if (typeof vm.car.features === 'string') {
          vm.car.features = vm.car.features.split(',').map(feature => feature.trim());
        } else if (!Array.isArray(vm.car.features)) {
          vm.car.features = [];
        }
        
        // Format the vehicle status for display
        vm.car.formattedStatus = vm.car.status === 'available' ? 'Available' : 'Unavailable';
        
        console.log('Final carImages array:', vm.carImages);
        vm.activeSlide = 0;
        
        vm.setActiveSlide = function(index) {
          if (index >= 0 && index < vm.carImages.length) {
            vm.activeSlide = index;
          }
        };
        
        vm.bidData = {
          vehicleId: vm.car.vehicle_id,
          bidAmount: null,
          bidStartDate: '',
          bidEndDate: '',
          govtId: '',
          bidMessage: '',
          isOutstation: false,
          minPrice: Number(vm.car.pricing.basePrice) || 0,
          minPriceOutstation: Number(vm.car.pricing.outstationPrice || (vm.car.pricing.basePrice * 1.2)) || 0
        };

        // Only call for highest bid if we have a valid vehicle ID
        if (vm.car.vehicle_id) {
          let callbackCalled = false;
          
          BiddingService.getHighestBid(vm.car.vehicle_id)
            .then(function(highestBidData) {
              console.log('Highest bid data retrieved:', highestBidData);
              let highestBidVal = null;
              if (highestBidData !== null && highestBidData !== undefined) {
                // Just use the numeric value directly
                highestBidVal = highestBidData;
                console.log('Using highest bid value:', highestBidVal);
              }
              
              if (!callbackCalled) {
                callbackCalled = true;
                callback(null, highestBidVal);
              }
            })
            .catch(function(err) {
              // Even if this fails, continue with null
              console.warn('Unable to get highest bid:', err);
              if (!callbackCalled) {
                callbackCalled = true;
                callback(null, null);
              }
            });
        } else {
          console.error('Cannot fetch highest bid: Missing vehicle ID');
          callback(null, null);
        }
      }
    ], function(err, highestBidVal) {
      if (err) {
        console.error("Error in car details initialization:", err);
        vm.errorMessage = "Error loading car details. Please try again.";
        return;
      }
      vm.highestBid = highestBidVal;
      console.log('Car details initialization complete');
      $scope.$applyAsync();
    });
  }

  /**
   * Opens the bid modal using $uibModal.
   * @function openBidModal
   */
  function openBidModal() {
    // Check if the car has a valid ID
    if (!vm.car || !vm.car.vehicle_id) {
      vm.errorMessage = "Cannot place bid: Invalid vehicle selection.";
      return;
    }
    
    if (vm.car.status !== 'available') {
      vm.errorMessage = "This car is not available for bidding.";
      return;
    }
    
    const currentUser = AuthService.getLoggedInUser();
    if (!currentUser) {
      // Show message but don't redirect
      vm.errorMessage = "Please log in to place a bid.";
      // Continue anyway - no return statement
    }

    vm.isUserHasGovtId = currentUser ? !!currentUser.user_govtId : false;
    
    // Initialize bid data before opening modal
    vm.bidData = {
      vehicleId: vm.car.vehicle_id,
      bidAmount: null,
      bidStartDate: '',
      bidEndDate: '',
      govtId: '',
      bidMessage: '',
      isOutstation: false,
      minPrice: Number(vm.car.pricing?.basePrice) || 0,
      minPriceOutstation: Number(vm.car.pricing?.basePriceOutstation || (vm.car.pricing?.basePrice * 1.2)) || 0
    };
    
    console.log('Opening bid modal for vehicle ID:', vm.bidData.vehicleId);
    
    // Additional error check for pricing
    if (!vm.car.pricing || !vm.car.pricing.basePrice) {
      console.warn('Car pricing information is missing or incomplete', vm.car.pricing);
    }
    
    const modalInstance = $uibModal.open({
      templateUrl: 'bidModalTemplate.html',
      controller: function($scope, $uibModalInstance, BiddingFactory) {
        $scope.vm = vm; 
        
        $scope.closeBidModal = function() {
          $uibModalInstance.dismiss('cancel');
        };
        
        $scope.submitBid = function(bidForm) {
          processBidSubmission(bidForm, true, $uibModalInstance);
        };
      },
      resolve: {
        BiddingFactory: function() {
          return BiddingFactory;
        }
      },
      size: 'lg'
    });
  }

  /**
   * Resets the bid data.
   * @function closeBidModal
   */
  function closeBidModal() {
    vm.bidData = {
      bidAmount: null,
      vehicleId: vm.car.vehicle_id,
      bidStartDate: '',
      bidEndDate: '',
      govtId: '',
      bidMessage: '',
      isOutstation: false,
      minPrice: vm.bidData.minPrice,
      minPriceOutstation: vm.bidData.minPriceOutstation
    };
  }

  /**
   * Updates the minimum bid amount display based on whether the bid is for outstation.
   * @function updateMinBidDisplay
   */
  function updateMinBidDisplay() {
    // If current bid amount is less than new minimum, update it
    const currentMinPrice = vm.bidData.isOutstation ? vm.bidData.minPriceOutstation : vm.bidData.minPrice;
    if (vm.bidData.bidAmount && vm.bidData.bidAmount < currentMinPrice) {
      vm.bidData.bidAmount = currentMinPrice;
    }
  }

  /**
   * Places a bid using the BiddingService.
   * @function placeBid
   */
  function placeBid(bidForm) {
    // Check if bid amount is provided
    if (!vm.bidData.bidAmount && vm.bidData.bidAmount !== 0) {
      vm.errorMessage = "Bid amount is required";
      return $q.reject("Bid amount is required");
    }
    
    // Ensure bid amount is a positive number
    const bidAmount = Number(vm.bidData.bidAmount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      vm.errorMessage = "Bid amount must be a positive number";
      return $q.reject("Bid amount must be a positive number");
    }
    
    // Validate required dates
    if (!vm.bidData.bidStartDate) {
      vm.errorMessage = "Start date is required";
      return $q.reject("Start date is required");
    }
    
    if (!vm.bidData.bidEndDate) {
      vm.errorMessage = "End date is required";
      return $q.reject("End date is required");
    }
    
    console.log('Placing bid with amount:', bidAmount);
    return processBidSubmission(bidForm, false);
  }

  /**
   * Starts a chat conversation with the car owner
   * @function startChat
   */
  function startChat() {
    console.log('Starting chat with car data:', vm.car);
    
    if (!vm.car || !vm.car.owner) {
      vm.errorMessage = "Cannot start chat: Invalid vehicle information";
      return;
    }

    // Get the current user using AuthService instead of $rootScope
    AuthService.getLoggedInUser()
      .then(function(currentUser) {
        if (!currentUser || !currentUser._id) {
          // Show message but don't redirect
          vm.errorMessage = "Please log in to start a chat";
          // Continue anyway by returning an object with necessary fields
          return { _id: 'anonymous-user' };
        }

        // Prevent chatting with yourself if logged in
        if (currentUser._id === vm.car.owner) {
          vm.errorMessage = "You cannot chat with yourself";
          return null;
        }
        
        return currentUser;
      })
      .then(function(currentUser) {
        if (!currentUser) return; // If returned early in the previous step
        
        // Ensure IDs are strings
        const sellerId = vm.car.owner && vm.car.owner._id ? vm.car.owner._id : vm.car.owner;
        const vehicleId = vm.car._id;
        const buyerId = currentUser._id;

        console.log('Creating conversation with:', {
          vehicleId: vehicleId,
          sellerId: sellerId,
          buyerId: buyerId
        });

        return MessagingService.createConversation({
          vehicleId: vehicleId,
          sellerId: sellerId,
          buyerId: buyerId
        });
      })
      .then(function(conversation) {
        if (!conversation) return; // If returned early in the previous step
        console.log('Conversation created successfully:', conversation);
        
        // Redirect directly to the chat page with this conversation
        $state.go('chat', { 
          conversationId: conversation.conversation_id 
        });
      })
      .catch(function(error) {
        console.error('Error starting chat:', error);
        vm.errorMessage = error.data?.message || 'Failed to start chat. Please try again.';
      });
  }

  // Add this shared function to handle the common bid submission logic
  function processBidSubmission(bidForm, fromModal, $uibModalInstance) {
    if (!bidForm.$valid) {
      Object.keys(bidForm.$error).forEach(function(errorKey) {
        bidForm.$error[errorKey].forEach(function(field) {
          field.$setTouched();
        });
      });
      return $q.reject("Form is invalid");
    }
    
    // Double check bid amount is provided
    if (!vm.bidData.bidAmount && vm.bidData.bidAmount !== 0) {
      vm.errorMessage = "Bid amount is required";
      console.error('Bid amount is missing:', vm.bidData);
      return $q.reject("Bid amount is required");
    }
    
    // Double check vehicle ID exists
    if (!vm.bidData.vehicleId) {
      console.error('Vehicle ID is undefined when submitting bid');
      vm.errorMessage = "Cannot place bid: Invalid vehicle ID.";
      return $q.reject("Invalid vehicle ID");
    }
    
    // Format dates for submission if needed
    let startDate = vm.bidData.bidStartDate;
    let endDate = vm.bidData.bidEndDate;
    
    // If dates are Date objects, convert to ISO strings
    if (startDate instanceof Date) {
      startDate = startDate.toISOString().split('T')[0];
    }
    
    if (endDate instanceof Date) {
      endDate = endDate.toISOString().split('T')[0];
    }

    // Create a Bidding instance using the factory
    const bidding = BiddingFactory.createBidding({
      vehicle: vm.bidData.vehicleId,
      bid_amount: Number(vm.bidData.bidAmount),
      booking_start_date: startDate,
      booking_end_date: endDate,
      is_outstation: vm.bidData.isOutstation,
      bid_message: vm.bidData.bidMessage || '',
      bid_status: 'pending'
    });
    
    // Logging for debugging
    console.log('Preparing bid with amount:', vm.bidData.bidAmount);
    console.log('Converted to number:', Number(vm.bidData.bidAmount));
    console.log('Final bid object:', bidding);
    
    // Add government ID separately as it's not part of the Bidding class
    const govtId = vm.bidData.govtId;
    if (govtId) {
      bidding.govtId = govtId;
    }
    
    console.log('Submitting bid with data:', bidding);

    // Validate the bid using the factory's comprehensive validation
    const validationErrors = BiddingFactory.validateBid(bidding, 'full');
    if (validationErrors.length > 0) {
      vm.errorMessage = validationErrors.join('. ');
      return $q.reject(vm.errorMessage);
    }
    
    // Additional client-side validations
    // Check minimum bid amount based on car pricing
    const minPrice = vm.bidData.isOutstation ? 
      Number(vm.bidData.minPriceOutstation) : 
      Number(vm.bidData.minPrice);
    
    if (Number(bidding.bid_amount) < minPrice) {
      vm.errorMessage = `Bid amount must be at least ${minPrice}`;
      return $q.reject(vm.errorMessage);
    }
    
    // Validate Government ID if required and not already provided
    if (!vm.isUserHasGovtId && !govtId) {
      vm.errorMessage = "Government ID is required for new users";
      return $q.reject(vm.errorMessage);
    }

    // Submit the bid using the service
    return BiddingService.submitBid(bidding)
      .then(function(response) {
        console.log('Bid placed successfully:', response);
        
        // Create a Bidding instance from the response
        const bidResponse = BiddingFactory.createBidding(response);
        console.log('Created bid response object:', bidResponse);
        
        // Close modal if it was opened from modal
        if (fromModal && $uibModalInstance) {
          $uibModalInstance.close();
        } else {
          vm.closeBidModal();
        }
        
        return BiddingService.getHighestBid(bidding.vehicle);
      })
      .then(function(highestBidData) {
        // Convert highest bid data to Bidding instance
        const highestBid = highestBidData ? BiddingFactory.createBidding(highestBidData) : null;
        vm.highestBid = highestBid;
        vm.successMessage = "Your bid has been placed successfully!";
        
        // Get current user and create conversation
        return AuthService.getLoggedInUser()
          .then(function(currentUser) {
            if (!currentUser) {
              console.error('User not logged in when navigating to chat after bid');
              return null;
            }
            
            // Use the owner ID directly from the car object
            const sellerId = vm.car.owner;
            if (!sellerId) {
              console.error('Could not retrieve seller ID from car data after placing bid');
              vm.successMessage = "Your bid was placed successfully! You can view it in your bids.";
              return null;
            }
            
            // Prepare data for conversation creation
            const conversationData = {
              vehicleId: bidding.vehicle, // Use vehicle ID from the bid
              sellerId: String(sellerId), // Ensure sellerId is a string
              buyerId: currentUser._id
            };
            
            console.log('Creating conversation with data:', conversationData);
            
            // Use MessagingService to create the conversation
            return MessagingService.createConversation(conversationData)
              .catch(function(error) {
                // If conversation creation fails, still consider the bid successful
                console.error('Error creating conversation, but bid was placed:', error);
                vm.successMessage = "Your bid was placed successfully! You can view it in your bids.";
                return null;
              });
          });
      })
      .then(function(conversation) {
        if (!conversation) return; // If returned early in previous steps
        
        // Redirect directly to the chat page
        console.log('Redirecting to chat with conversation ID:', conversation.conversation_id);
        $state.go('chat', { 
          conversationId: conversation.conversation_id 
        });
      })
      .catch(function(error) {
        vm.errorMessage = error || "Failed to place bid. Please try again.";
        console.error('Bid placement error:', error);
        return $q.reject(error);
      });
  }
}
