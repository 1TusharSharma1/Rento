// src/app/views/auth/signup/signup.controller.js
    'use strict';
  
    angular
      .module('carRentalApp')
      .controller('SellerSignupController', SellerSignupController);
  
    SellerSignupController.$inject = ['AuthService', '$state'];
    
    function SellerSignupController(AuthService, $state) {
      const vm = this;
  
      vm.email = '';
      vm.businessName = '';
      vm.phone = '';
      vm.line1 = '';
      vm.line2 = '';
      vm.city = '';
      vm.state = '';
      vm.pincode = '';
      vm.password = '';
      vm.confirmPassword = '';
  
      vm.signUpSeller = signUpSeller;
  
      function signUpSeller() {
        AuthService.signUpSeller(
          vm.email,
          vm.businessName,
          vm.phone,
          vm.password,
          vm.confirmPassword,
          vm.line1,
          vm.line2,
          vm.city,
          vm.state,
          vm.pincode
        )
          .catch(function(error) {
            alert(error);
          });
      }
    }

  