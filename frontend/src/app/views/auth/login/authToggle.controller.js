// src/app/views/auth/authToggle.controller.js
    'use strict';
  
    angular
      .module('carRentalApp')
      .controller('AuthToggleController', AuthToggleController);
  
    AuthToggleController.$inject = ['$state'];
    
    function AuthToggleController($state) {
      let at = this;
      
      at.activeForm = 'login';
      
      at.toggleForms = function(formName) {
        at.activeForm = formName;
      };
      
      at.goSeller = function() {
        $state.go('signup');
      };
    }
  