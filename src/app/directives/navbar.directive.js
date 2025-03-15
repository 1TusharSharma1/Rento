(function() {
  'use strict';

  angular
    .module('carRentalApp')
    .directive('appNavbar', appNavbar);

  function appNavbar() {
    return {
      restrict: 'E',
      templateUrl: 'app/components/navbar/navbar.html',
      scope: {
        activeState: '@'
      },
      controller: NavbarController,
      controllerAs: 'vm',
      bindToController: true
    };
  }

  NavbarController.$inject = ['$state', 'AuthService'];

  function NavbarController($state, AuthService) {
    var vm = this;
    
    vm.isCollapsed = true;
    vm.userProfile = AuthService.getLoggedInUser() || {};
    
    // Methods
    vm.logout = logout;
    vm.isAdmin = isAdmin;
    vm.isSeller = isSeller;
    vm.isBuyer = isBuyer;
    vm.isLoggedIn = isLoggedIn;
    vm.getHomeState = getHomeState;
    vm.getUserRoleDisplay = getUserRoleDisplay;
    
    function isLoggedIn() {
      return !!vm.userProfile && !!vm.userProfile.user_id;
    }
    
    function isAdmin() {
      if (!isLoggedIn()) return false;
      
      var roles = vm.userProfile.roles || vm.userProfile.user_role || [];
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('admin');
    }
    
    function isSeller() {
      if (!isLoggedIn()) return false;
      
      var roles = vm.userProfile.roles || vm.userProfile.user_role || [];
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('seller');
    }
    
    function isBuyer() {
      if (!isLoggedIn()) return false;
      
      var roles = vm.userProfile.roles || vm.userProfile.user_role || [];
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('buyer') || roles.includes('user');
    }
    
    function getHomeState() {
      if (isAdmin()) return 'superAdmin';
      if (isSeller()) return 'sellerDashboard';
      if (isBuyer()) return 'buyerHome';
      return 'landingPage';
    }
    
    function getUserRoleDisplay() {
      if (isAdmin()) return 'Admin';
      if (isSeller()) return 'Seller';
      if (isBuyer()) return 'User';
      return 'Guest';
    }
    
    function logout() {
      AuthService.logout()
        .then(function() {
          $state.go('login');
        })
        .catch(function(error) {
          console.error('Logout error:', error);
        });
    }
  }
})();