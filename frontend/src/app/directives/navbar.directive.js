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

  NavbarController.$inject = ['$state', 'AuthService', '$rootScope'];

  function NavbarController($state, AuthService, $rootScope) {
    const vm = this;
    
    vm.isCollapsed = true;
    vm.userProfile = {};
    
    // Methods
    vm.logout = logout;
    vm.isAdmin = isAdmin;
    vm.isSeller = isSeller;
    vm.isBuyer = isBuyer;
    vm.isLoggedIn = isLoggedIn;
    vm.getUserRoleDisplay = getUserRoleDisplay;
    
    // Initialize - fetch current user
    AuthService.getLoggedInUser()
      .then(function(user) {
        vm.userProfile = user;
      })
      .catch(function() {
        // User not logged in - this is fine
        vm.userProfile = {};
      });
    
    // Listen for authentication changes
    $rootScope.$on('auth:userLoggedIn', function(event, userData) {
      vm.userProfile = userData;
    });
    
    $rootScope.$on('auth:userLoggedOut', function() {
      vm.userProfile = {};
      $rootScope.userRole = null;
    });
    
    function isLoggedIn() {
      return !!vm.userProfile && !!vm.userProfile._id;
    }
    
    function isAdmin() {
      // First check $rootScope for faster access
      if ($rootScope.userRole && $rootScope.userRole.includes('admin')) {
        return true;
      }
      
      if (!isLoggedIn()) return false;
      
      const role = vm.userProfile.role || '';
      let roles = vm.userProfile.user_role || [];
      
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('admin') || role === 'admin';
    }
    
    function isSeller() {
      // First check $rootScope for faster access
      if ($rootScope.userRole && $rootScope.userRole.includes('seller')) {
        return true;
      }
      
      if (!isLoggedIn()) return false;
      
      const role = vm.userProfile.role || '';
      let roles = vm.userProfile.user_role || [];
      
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('seller') || role === 'seller';
    }
    
    function isBuyer() {
      // First check $rootScope for faster access
      if ($rootScope.userRole && 
          ($rootScope.userRole.includes('buyer') || 
           $rootScope.userRole.includes('user'))) {
        return true;
      }
      
      if (!isLoggedIn()) return false;
      
      const role = vm.userProfile.role || '';
      let roles = vm.userProfile.user_role || [];
      
      if (!Array.isArray(roles)) roles = [roles];
      
      return roles.includes('buyer') || roles.includes('user') || role === 'buyer' || role === 'user';
    }
    
    function getUserRoleDisplay() {
      if (isAdmin()) return 'Admin';
      if (isSeller()) return 'Seller';
      if (isBuyer()) return 'User';
      return 'Guest';
    }
    
    function logout() {
      AuthService.logoutUser()
        .then(function() {
          $state.go('login');
        })
        .catch(function(error) {
          console.error('Logout error:', error);
          $state.go('login');
        });
    }
  }
})();