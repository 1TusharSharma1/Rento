'use strict';
  
angular
  .module('carRentalApp')
  .controller('SuperAdminController', SuperAdminController);

SuperAdminController.$inject = ['$http', 'AuthService', 'AppConfig', '$state', '$scope'];

function SuperAdminController($http, AuthService, AppConfig, $state, $scope) {
  const vm = this;
  const API_BASE = AppConfig.apiBaseUrl || 'http://localhost:5050';
  
  // Users data
  vm.users = [];
  vm.loading = false;
  vm.error = null;
  
  // Pagination
  vm.currentPage = 1;
  vm.itemsPerPage = 10;
  vm.totalItems = 0;
  vm.totalPages = 0;
  
  // Search
  vm.searchTerm = '';
  vm.searchTimeout = null;
  vm.isSearching = false;
  vm.DEBOUNCE_TIME = 500; // Configurable debounce time in ms
  
  // Controller methods
  vm.loadUsers = loadUsers;
  vm.toggleUserLock = toggleUserLock;
  vm.pageChanged = pageChanged;
  vm.searchUsers = searchUsers;
  vm.clearSearch = clearSearch;
  vm.logout = logout;
  
  function init() {
    loadUsers();
    
    // Cancel pending search when controller is destroyed
    $scope.$on('$destroy', function() {
      if (vm.searchTimeout) {
        clearTimeout(vm.searchTimeout);
      }
    });
  }
  
  /**
   * Loads users from backend with pagination and optional search
   */
  function loadUsers() {
    vm.loading = true;
    vm.error = null;
    
    // Create params object with pagination and optional search
    const params = {
      page: vm.currentPage,
      limit: vm.itemsPerPage,
      search: vm.searchTerm || undefined // Only include if not empty
    };
    
    $http.get(`${API_BASE}/api/v1/admin/users`, { 
      params,
      withCredentials: true 
    })
    .then(function(response) {
      const { data } = response.data || {};
      if (data) {
        vm.users = data.users || [];
        vm.totalItems = data.pagination?.total || 0;
        vm.totalPages = data.pagination?.pages || 0;
      } else {
        vm.users = [];
        vm.totalItems = 0;
        vm.totalPages = 0;
      }
    })
    .catch(function(error) {
      console.error('Error loading users:', error);
      vm.error = error.data?.message || 'Failed to load users';
      vm.users = [];
    })
    .finally(function() {
      vm.loading = false;
      vm.isSearching = false;
    });
  }
  
  /**
   * Handles page change event
   */
  function pageChanged() {
    loadUsers();
  }
  
  /**
   * Handles search input with debounce
   */
  function searchUsers() {
    // Set searching indicator 
    vm.isSearching = true;
    
    if (vm.searchTimeout) {
      clearTimeout(vm.searchTimeout);
    }
    
    vm.searchTimeout = setTimeout(function() {
      vm.currentPage = 1; // Reset to first page for new search
      loadUsers();
    }, vm.DEBOUNCE_TIME);
  }
  
  /**
   * Clears search and resets results
   */
  function clearSearch() {
    if (vm.searchTerm) {
      vm.searchTerm = '';
      vm.currentPage = 1;
      loadUsers();
    }
  }
  
  /**
   * Toggles user lock status
   * @param {Object} user - The user to toggle lock status
   */
  function toggleUserLock(user) {
    if (!confirm(`Are you sure you want to ${user.isLocked ? 'unlock' : 'lock'} this user?`)) {
      return;
    }
    
    $http.patch(`${API_BASE}/api/v1/admin/users/${user._id}/toggle-lock`, {}, {
      withCredentials: true
    })
    .then(function(response) {
      if (response.data && response.data.data) {
        user.isLocked = response.data.data.user.isLocked;
      }
    })
    .catch(function(error) {
      console.error('Error toggling user lock status:', error);
      alert('Failed to update user. ' + (error.data?.message || ''));
    });
  }
  
  /**
   * Logs the admin user out
   */
  function logout() {
    AuthService.logout().then(function() {
      $state.go('login');
    });
  }
  
  // Initialize the controller
  init();
}