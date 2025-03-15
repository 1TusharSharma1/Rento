'use strict';

angular
  .module('carRentalApp')
  .controller('SellerDashboardController', SellerDashboardController);

SellerDashboardController.$inject = ['$scope', 'SellerDashboardService', 'AuthService', 'DbService', '$state', '$q'];

function SellerDashboardController($scope, SellerDashboardService, AuthService, DbService, $state, $q) {
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
  
  function init() {
    console.log('Init function called');
    
    vm.userProfile = AuthService.getLoggedInUser();
    console.log('User Profile:', vm.userProfile);
    if (!vm.userProfile || !vm.userProfile.user_role.includes('seller')) {
      console.error('Invalid user or not a seller');
      $state.go('login');
      return;
    }

    return DbService.isReady
      .then(function() {
        console.log('Database ready, loading bids...');
        return loadBids('Active');
      })
      .catch(function(error) {
        console.error('Error during initialization:', error);
        vm.error = "Failed to initialize. Please refresh the page.";
        return $q.reject(error);
      });
  }
  
  function loadBids(status) {
    console.log('[SellerDashboardController] LoadBids called with status:', status);
    vm.loading = true;
    vm.error = null;
    
    return SellerDashboardService.loadBids(status)
      .then(function(bids) {
        console.log('[SellerDashboardController] Bids loaded successfully:', bids);
        vm.bids = bids;
        vm.loading = false;
      })
      .catch(function(error) {
        console.error("[SellerDashboardController] Error loading bids:", error);
        vm.error = "Failed to load bids. Please try again.";
        vm.loading = false;
      });
  }
  
  function acceptBid(bid) {
    if (confirm('Are you sure you want to accept this bid?')) {
      SellerDashboardService.updateBidStatus(bid.bid_id, 'Accepted')
        .then(function() {
          alert("Bid accepted successfully!");
          return loadBids('Active');
        })
        .catch(function(error) {
          console.error("Error accepting bid:", error);
          alert("Failed to accept bid. Please try again.");
          return $q.reject(error);
        });
    }
  }
  
  function rejectBid(bid) {
    if (confirm('Are you sure you want to reject this bid?')) {
      SellerDashboardService.updateBidStatus(bid.bid_id, 'Rejected')
        .then(function() {
          alert("Bid rejected successfully!");
          return loadBids('Active');
        })
        .catch(function(error) {
          console.error("Error rejecting bid:", error);
          alert("Failed to reject bid. Please try again.");
          return $q.reject(error);
        });
    }
  }
}