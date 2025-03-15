// src/app/views/auth/login/login.controller.js

    'use strict';
  
    angular
      .module('carRentalApp')
      .controller('LoginController', LoginController)
      .controller('BuyerSignupController', BuyerSignupController);
  
    LoginController.$inject = ['AuthService', '$state'];
    function LoginController(AuthService, $state) {
      const vm = this;
      
      vm.email = '';
      vm.password = '';
      vm.loginUser = loginUser;
  
      function loginUser() {
        AuthService.loginUser(vm.email, vm.password)
          .then(function(user) {
            if (user.user_role.includes('seller')) {
              $state.go('sellerDashboard');
            } else if (user.user_role.includes('buyer')) {
              $state.go('buyerHome');
            } else if (user.user_role.includes('admin')) {
              $state.go('superAdmin');
            }
          })
          .catch(function(error) {
            alert(error);
          });
      }
    }
  
    BuyerSignupController.$inject = ['AuthService', '$state'];
    function BuyerSignupController(AuthService, $state) {
      const buyVM = this;
      
      buyVM.email = '';
      buyVM.username = '';
      buyVM.password = '';
      buyVM.confirmPassword = '';
      
      buyVM.signUpBuyer = signUpBuyer;
  
      function signUpBuyer() {
        AuthService.signUpBuyer(buyVM.email, buyVM.username, buyVM.password, buyVM.confirmPassword)
          .then(function(newUser) {
            $state.go('buyerHome');
          })
          .catch(function(error) {
            alert(error);
          });
      }
    }