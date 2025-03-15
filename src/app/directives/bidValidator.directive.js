// src/app/directives/bidValidator.js
    'use strict';
    
    angular
      .module('carRentalApp')
      .directive('bidValidator', bidValidator);
    
    function bidValidator() {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function(ngModel) {
          ngModel.$validators.bidValidator = function(modelValue) {
            if (!modelValue) return false;
            
            const bidAmount = Number(modelValue);
            return !isNaN(bidAmount) && bidAmount > 0;
          };
        }
      };
    }
