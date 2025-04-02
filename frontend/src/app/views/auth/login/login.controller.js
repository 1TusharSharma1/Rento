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
  vm.errorMessage = '';
  vm.isLoading = false;
  vm.loginUser = loginUser;

  function loginUser() {
    if (!vm.email || !vm.password) {
      vm.errorMessage = 'Please enter both email and password';
      return;
    }

    vm.isLoading = true;
    vm.errorMessage = '';

    AuthService.loginUser(vm.email, vm.password)
      .then(function(user) {
        // Redirection is handled by AuthService.loginUser
      })
      .catch(function(error) {
        vm.errorMessage = error || 'Login failed. Please try again.';
      })
      .finally(function() {
        vm.isLoading = false;
      });
  }
}

BuyerSignupController.$inject = ['AuthService', '$state'];
function BuyerSignupController(AuthService, $state) {
  const buyVM = this;
  
  buyVM.email = '';
  buyVM.username = '';
  buyVM.phone = '';
  buyVM.password = '';
  buyVM.confirmPassword = '';
  buyVM.errorMessage = '';
  buyVM.isLoading = false;
  
  buyVM.signUpBuyer = signUpBuyer;

  function signUpBuyer() {
    if (!buyVM.email || !buyVM.username || !buyVM.phone || !buyVM.password || !buyVM.confirmPassword) {
      buyVM.errorMessage = 'Please fill in all fields';
      return;
    }

    buyVM.isLoading = true;
    buyVM.errorMessage = '';

    AuthService.signUpBuyer(buyVM.email, buyVM.username, buyVM.phone, buyVM.password, buyVM.confirmPassword)
      .then(function(user) {
        // Redirection is handled by AuthService.signUpBuyer
        // No need to do anything here as AuthService will handle the state change
      })
      .catch(function(error) {
        buyVM.errorMessage = error || 'Sign up failed. Please try again.';
      })
      .finally(function() {
        buyVM.isLoading = false;
      });
  }
}