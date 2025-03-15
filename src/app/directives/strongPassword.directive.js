// src/app/directives/strongPassword.js
    'use strict';
    
    angular
      .module('carRentalApp')
      .directive('strongPassword', strongPassword);
    
    function strongPassword() {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function( ngModel) {
          ngModel.$validators.strongPassword = function(modelValue) {
            if (!modelValue) return false;
            
            const hasUpperCase = /[A-Z]/.test(modelValue);
            const hasLowerCase = /[a-z]/.test(modelValue);
            const hasNumbers = /\d/.test(modelValue);
            const hasSpecial = /[^A-Za-z0-9]/.test(modelValue);
            const isLongEnough = modelValue.length >= 6;
            
            return hasUpperCase && hasNumbers && hasSpecial && isLongEnough && hasLowerCase;
          };
        }
      };
    }
