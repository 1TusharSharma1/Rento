'use strict';

angular
  .module('carRentalApp')
  .controller('SellerDashboardController', SellerDashboardController);

SellerDashboardController.$inject = ['$scope', 'SellerDashboardService', 'BiddingService', 'BookingService', 'AuthService', 'DbService', '$state', '$q', 'BiddingFactory'];

function SellerDashboardController($scope, SellerDashboardService, BiddingService, BookingService, AuthService, DbService, $state, $q, BiddingFactory) {
  console.log('SellerDashboardController instantiated');
  
  // Controller instance
  const vm = this;
  vm.bids = [];
  vm.userProfile = null;
  vm.loading = true;
  vm.error = null;
  
  // Public functions
  vm.init = init;
  vm.acceptBid = acceptBid;
  vm.rejectBid = rejectBid;
  
  // Call init on controller startup
  init();
  
  function init() {
    console.log('Init function called');
    vm.loading = true;
    
    // Force a fresh check with the server for authentication
    AuthService.getCurrentUser()
      .then(function(user) {
        console.log('User Profile:', user);
        vm.userProfile = user;
        
        if (!vm.userProfile || !vm.userProfile.user_role.includes('seller')) {
          console.error('Invalid user or not a seller');
          $state.go('login');
          return $q.reject('Not authorized as seller');
        }

        return DbService.isReady;
      })
      .then(function() {
        console.log('Database ready, loading bids...');
        return loadBids('pending');
      })
      .catch(function(error) {
        console.error('Error during initialization:', error);
        
        if (error === 'Not authenticated' || error === 'Not authorized as seller') {
          $state.go('login');
        } else {
          vm.error = "Failed to initialize. Please refresh the page.";
        }
        return $q.reject(error);
      })
      .finally(function() {
        vm.loading = false;
      });
  }
  
  function loadBids(status) {
    console.log('[SellerDashboardController] LoadBids called with status:', status);
    vm.loading = true;
    vm.error = null;
    
    return BiddingService.loadSellerBids(status)
      .then(function(bidsData) {
        console.log('[SellerDashboardController] Bids data loaded successfully:', bidsData);
        
        // Create Bidding objects using factory
        const bidObjects = BiddingFactory.createBiddingArray(bidsData);
        console.log('[SellerDashboardController] Created bid objects using factory:', bidObjects);
        
        // Map the Bidding instances to the expected format for the template
        vm.bids = bidObjects.map(function(bid) {
          return {
            ...bid,
            // Properties needed by the template
            vehicleModel: bid.vehicle_details?.title || 'Unknown Vehicle',
            bidderName: bid.bidder?.name || 'Unknown',
            bidAmount: bid.getFormattedAmount ? bid.getFormattedAmount() : ('₹' + bid.bid_amount.toFixed(2)),
            bidDate: bid.bid_date,
            bookingDuration: {
              start: bid.booking_start_date,
              end: bid.booking_end_date
            },
            isOutstation: bid.is_outstation,
            // Keep original Bidding instance properties
            bid_status: bid.bid_status,
            bid_id: bid.bid_id
          };
        });
        
        console.log('[SellerDashboardController] Processed bids for template:', vm.bids);
        vm.loading = false;
      })
      .catch(function(error) {
        console.error("[SellerDashboardController] Error loading bids:", error);
        vm.error = "Failed to load bids. Please try again.";
        vm.loading = false;
      });
  }
  
  function acceptBid(bid) {
    if (!confirm('Are you sure you want to accept this bid? This will convert it to a booking.')) {
      return;
    }
    
    // Prompt for a custom message
    const customMessage = prompt('Enter a message to the bidder (optional):');
    
    // Validate message length using factory validation
    if (customMessage) {
      const validationErrors = BiddingFactory.validateBid({
        bid_message: customMessage
      }, 'message');
      
      if (validationErrors.length > 0) {
        alert(validationErrors.join('\n'));
        return;
      }
    }
    
    vm.loading = true;
    
    // Make sure we're working with the bid ID, not the entire bid object
    const bidId = bid.bid_id;
    console.log("[SellerDashboardController] Accepting bid with ID:", bidId);
    
    // Use BookingService to accept and convert the bid
    BookingService.acceptAndConvertBid(bidId, customMessage)
      .then(function(bookingData) {
        // Success handling
        vm.loading = false;
        alert("Success! Bid accepted and converted to a booking.");
        return loadBids('pending');
      })
      .catch(function(error) {
        vm.loading = false;
        console.error("Error in bid acceptance/conversion process:", error);
        alert("Failed to process the bid: " + (error.data?.message || error.message || error));
        return loadBids('pending');
      });
  }
  
  function rejectBid(bid) {
    if (!confirm('Are you sure you want to reject this bid?')) {
      return;
    }
    
    // Prompt for a custom message
    const customMessage = prompt('Enter a reason or message to the bidder (optional):');
    
    // Validate message length using factory validation
    if (customMessage) {
      const validationErrors = BiddingFactory.validateBid({
        bid_message: customMessage
      }, 'message');
      
      if (validationErrors.length > 0) {
        alert(validationErrors.join('\n'));
        return;
      }
    }
    
    vm.loading = true;
    
    // Make sure we're working with the bid ID, not the entire bid object
    const bidId = bid.bid_id;
    console.log("[SellerDashboardController] Rejecting bid with ID:", bidId);
    
    // Use BiddingService directly for rejecting the bid
    BiddingService.respondToBid(bidId, 'rejected', customMessage)
      .then(function(updatedBidData) {
        // Success handling
        vm.loading = false;
        alert("Bid rejected successfully!");
        return loadBids('pending');
      })
      .catch(function(error) {
        vm.loading = false;
        console.error("Error rejecting bid:", error);
        alert("Failed to reject bid: " + (error.data?.message || error.message || error));
        return loadBids('pending');
      });
  }
}