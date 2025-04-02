/**
 * Simple configuration for the Car Rental App
 */
(function() {
  'use strict';
  
  // Create a global configuration object
  angular
    .module('carRentalApp')
    .constant('AppConfig', {
      // Backend API base URL
      apiBaseUrl: 'http://localhost:5050'
    });
})();
