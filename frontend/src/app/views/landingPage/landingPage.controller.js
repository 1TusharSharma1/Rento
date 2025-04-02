'use strict';

angular
  .module('carRentalApp')
  .controller('LandingPageController', LandingPageController);

LandingPageController.$inject = ['$state', 'AuthService'];

function LandingPageController($state, AuthService) {
  const vm = this;
  
  // Initialize view model properties
  vm.isLoading = false;
  vm.error = null;
  
  // Functions exposed to the view
  vm.scrollToCarousel = scrollToCarousel;
  vm.redirectIfLoggedIn = redirectIfLoggedIn;
  
  // Check if already logged in
  redirectIfLoggedIn();
  
  /**
   * Scroll to car carousel smoothly
   */
  function scrollToCarousel() {
    const carouselElement = document.getElementById('carCarousel');
    if (carouselElement) {
      carouselElement.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  /**
   * Check if user is logged in and redirect to appropriate page
   */
  function redirectIfLoggedIn() {
    const user = AuthService.getLoggedInUser();
    
    if (!user) {
      // Not logged in, stay on landing page
      return;
    }
    
    // Get user roles
    const userRoles = Array.isArray(user.user_role) ? user.user_role : [user.user_role];
    
    if (userRoles.includes('admin')) {
      $state.go('superAdmin');
    } else if (userRoles.includes('seller')) {
      $state.go('sellerDashboard');
    } else if (userRoles.includes('buyer') || userRoles.includes('user')) {
      $state.go('buyerHome');
    }
  }
}
