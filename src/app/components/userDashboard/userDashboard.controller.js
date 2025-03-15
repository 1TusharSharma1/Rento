'use strict';

angular
  .module('carRentalApp')
  .controller('UserDashboardController', UserDashboardController);

UserDashboardController.$inject = ['$scope', 'AuthService', '$state', 'DbService', '$q'];

function UserDashboardController($scope, AuthService, $state, DbService, $q) {
  const vm = this;


  vm.userProfile = null;
  vm.loading = true;
  vm.error = null;
  vm.hasSellerRole = false;


  vm.init = init;
  vm.logout = logout;
  vm.goToSellerDashboard = goToSellerDashboard;


  init();

  /**
   * Initializes the dashboard and ensures user data is properly loaded
   * @return {Promise|void} Returns a promise when address loading is involved
   */
  function init() {
    vm.loading = true;
    vm.error = null;

    vm.userProfile = AuthService.getLoggedInUser();

    if (!vm.userProfile) {
      console.error('No user logged in');
      vm.error = "You must be logged in to view this page.";
      $state.go('login');
      return;
    }


    vm.hasSellerRole = vm.userProfile.user_role && vm.userProfile.user_role.includes('seller');


    if (!vm.userProfile.address && vm.userProfile.address_id) {
      return DbService.getRecord('addresses', vm.userProfile.address_id)
        .then(function(address) {
          vm.userProfile.address = address;
          return address;
        })
        .catch(function(error) {
          console.error("Error fetching address:", error);
          return $q.reject(error);
        })
        .finally(function() {
          vm.loading = false;
        });
    }

    vm.loading = false;
    return $q.when(true);
  }


  function logout() {
    if (confirm('Are you sure you want to log out?')) {
      return AuthService.logoutUser()
        .then(function() {
          $state.go('login');
        })
        .catch(function(error) {
          console.error("Error during logout:", error);
          alert("Failed to log out. Please try again.");
          return $q.reject(error);
        });
    }
  }

  /**
   * Navigates to seller dashboard if user has seller permissions
   */
  function goToSellerDashboard() {
    if (vm.hasSellerRole) {
      $state.go('sellerDashboard');
    } else {
      alert("You don't have seller permissions.");
    }
  }
}
