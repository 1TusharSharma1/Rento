'use strict';

angular
  .module('carRentalApp')
  .controller('LandingPageController', LandingPageController);

LandingPageController.$inject = ['$state'];

function LandingPageController($state) {
  const vm = this;
  vm.scrollToCarousel = function() {
    const carouselElement = document.getElementById('carCarousel');
    if (carouselElement) {
      carouselElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Function to navigate to buyer home page
  if(AuthService.isLoggedIn()) {
    $state.go('buyerHome');
  }
}
