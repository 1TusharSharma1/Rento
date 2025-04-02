// src/app/directives/validEmail.js
    'use strict';
    
    angular
      .module('carRentalApp')
      .directive('validEmail', validEmail);
    
    function validEmail() {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function( ngModel) {
          ngModel.$validators.validEmail = function(modelValue) {
            if (!modelValue) return false;
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return emailRegex.test(modelValue);
          };
        }
      };
    }
