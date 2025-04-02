'use strict';

angular
  .module('carRentalApp')
  .controller('UserDashboardController', UserDashboardController);

UserDashboardController.$inject = ['$scope', 'AuthService', '$state'];

function UserDashboardController($scope, AuthService, $state) {
  const vm = this;
  vm.userProfile = null;
  vm.loading = true;
  vm.error = null;

  // Initialize
  AuthService.getLoggedInUser()
    .then(function(user) {
      if (!user) {
        throw new Error('No user logged in');
      }
      vm.userProfile = user;
    })
    .catch(function(error) {
      console.error('Error loading user profile:', error);
      vm.error = "Failed to load user profile. Please try again.";
      $state.go('login');
    })
    .finally(function() {
      vm.loading = false;
    });

  // Navigation methods
  vm.goToSellerDashboard = function() {
    if (vm.userProfile && vm.userProfile.user_role.includes('seller')) {
      $state.go('sellerDashboard');
    }
  };

  vm.goToBuyerHome = function() {
    if (vm.userProfile && (vm.userProfile.user_role.includes('buyer') || vm.userProfile.user_role.includes('user'))) {
      $state.go('buyerHome');
    }
  };

  vm.goToAdminDashboard = function() {
    if (vm.userProfile && vm.userProfile.user_role.includes('admin')) {
      $state.go('superAdmin');
    }
  };

  vm.logout = function() {
    if (confirm('Are you sure you want to log out?')) {
      AuthService.logoutUser()
        .then(function() {
          $state.go('login');
        })
        .catch(function(error) {
          console.error('Logout error:', error);
          $state.go('login');
        });
    }
  };
}
