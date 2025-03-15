'use strict';
  
angular
  .module('carRentalApp')
  .controller('SuperAdminController', SuperAdminController);

SuperAdminController.$inject = ['$q', 'DbService', 'AnalyticsService', 'AuthService'];

function SuperAdminController($q, DbService, AnalyticsService, AuthService) {
  const vm = this;
  vm.stats = {
    totalUsers: 0,
    totalVehicles: 0,
    totalBookings: 0,
    totalBids: 0,
    totalMessages: 0,
    totalRevenue: 0
  };
  
  // Data collections
  vm.users = [];
  vm.listings = [];
  vm.currentUserPage = 1;
  vm.currentListingPage = 1;
  vm.itemsPerPage = 5;
  vm.userTotalPages = 0;
  vm.listingTotalPages = 0;
  vm.loadAnalytics = loadAnalytics;
  vm.loadUsers = loadUsers;
  vm.loadListings = loadListings;
  vm.goToUserPage = goToUserPage;
  vm.goToListingPage = goToListingPage;
  vm.listVehicle = listVehicle;
  vm.delistVehicle = delistVehicle;
  vm.viewSellerListings = viewSellerListings;
  vm.logout = logout;
  
  vm.init = init;
  
  
  function init() {
    loadAnalytics();
    loadUsers();
    loadListings();
  }
  
  /**
   * Loads dashboard analytics data from multiple sources
   * Aggregates user counts, vehicle counts, and activity metrics
   */
  function loadAnalytics() {
    $q.all([
      AnalyticsService.getTotalUsers(),
      AnalyticsService.getTotalVehicles(),
      AnalyticsService.getTotalBookings(),
      AnalyticsService.getTotalBids(),
      AnalyticsService.getTotalMessages(),
      AnalyticsService.getTotalRevenue()
    ]).then(function(results) {
      vm.stats.totalUsers = results[0];
      vm.stats.totalVehicles = results[1];
      vm.stats.totalBookings = results[2];
      vm.stats.totalBids = results[3];
      vm.stats.totalMessages = results[4];
      vm.stats.totalRevenue = results[5] || 0;
    });
  }
  
  /**
   * Retrieves all user accounts from the database
   * Sets up pagination for the user list
   * @return {Promise} Promise resolving to users array
   */
  function loadUsers() {
    return DbService.getAllRecords('users')
      .then(function(users) {
        
        vm.users = users.map(user => {
          let roles;
          
          if (user.roles) {
            roles = Array.isArray(user.roles) ? user.roles : user.roles.split(',');
          } else if (user.user_role) {
            roles = Array.isArray(user.user_role) ? user.user_role : [user.user_role];
          } else {
            roles = ['user'];
          }
          
          roles = roles.map(role => role.trim()).filter(role => role);
          
          return {
            ...user,
            roles: roles
          };
        });
        
        vm.userTotalPages = Math.ceil(users.length / vm.itemsPerPage);
        return users;
      })
      .catch(function(error) {
        console.error('Error loading users:', error);
        return [];
      });
  }
  
  /**
   * Retrieves all vehicle listings from the database
   * Sets up pagination for the listings view
   * @return {Promise} Promise resolving to vehicles array
   */
  function loadListings() {
    return DbService.getAllRecords('vehicles')
      .then(function(vehicles) {
        vm.listings = vehicles;
        vm.listingTotalPages = Math.ceil(vehicles.length / vm.itemsPerPage);
        return vehicles;
      });
  }
  
  /**
   * Gets the subset of users for the current pagination page
   * @return {Array} Filtered array of users for current page
   */
  function getCurrentUserPageItems() {
    const startIndex = (vm.currentUserPage - 1) * vm.itemsPerPage;
    const endIndex = startIndex + vm.itemsPerPage;
    return vm.users.slice(startIndex, endIndex);
  }
  
  /**
   * Gets the subset of listings for the current pagination page
   * @return {Array} Filtered array of vehicle listings for current page
   */
  function getCurrentListingPageItems() {
    const startIndex = (vm.currentListingPage - 1) * vm.itemsPerPage;
    const endIndex = startIndex + vm.itemsPerPage;
    return vm.listings.slice(startIndex, endIndex);
  }
  
  /**
   * Navigates to specified user pagination page
   * @param {Number} page - The page number to navigate to
   */
  function goToUserPage(page) {
    if (page >= 1 && page <= vm.userTotalPages) {
      vm.currentUserPage = page;
    }
  }
  
  /**
   * Navigates to specified listings pagination page
   * @param {Number} page - The page number to navigate to
   */
  function goToListingPage(page) {
    if (page < 1 || page > vm.listingTotalPages) return;
    vm.currentListingPage = page;
  }
  
  /**
   * Makes a vehicle available for rental
   * @param {String} vehicleId - ID of the vehicle to list
   * @return {Promise} Promise resolving when operation is complete
   */
  function listVehicle(vehicleId) {
    if (!confirm('Are you sure you want to list this vehicle again?')) return;
    
    return DbService.getRecord('vehicles', vehicleId)
      .then(function(vehicle) {
        vehicle.status = 'active';
        return DbService.updateRecord('vehicles', vehicle);
      })
      .then(function() {
        return loadListings();
      });
  }
  
  /**
   * Makes a vehicle unavailable for rental
   * @param {String} vehicleId - ID of the vehicle to delist
   * @return {Promise} Promise resolving when operation is complete
   */
  function delistVehicle(vehicleId) {
    if (!confirm('Are you sure you want to de-list this listing?')) return;
    
    return DbService.getRecord('vehicles', vehicleId)
      .then(function(vehicle) {
        vehicle.status = 'inactive';
        return DbService.updateRecord('vehicles', vehicle);
      })
      .then(function() {
        return loadListings();
      });
  }
  
  /**
   * Navigates to view all listings from a specific seller
   * @param {String} sellerId - ID of the seller to view
   */
  function viewSellerListings(sellerId) {
    console.log('Viewing listings for seller:', sellerId);
    // Implement navigation to seller's listings
    // You could navigate to a filtered view or open a modal
  }
  // Add to your SuperAdminController
vm.showListingOptions = false;
vm.listingFilter = {
  vehicleModel: '',
  location: '',
  availability: ''
};
vm.listingSort = 'newest';
vm.filteredListings = [];

vm.toggleListingOptions = function() {
  vm.showListingOptions = !vm.showListingOptions;
};

vm.applyListingFilters = function() {
  vm.filteredListings = vm.listings.filter(function(listing) {
    let match = true;
    
    if (vm.listingFilter.vehicleModel) {
      match = match && listing.vehicleModel.toLowerCase().includes(vm.listingFilter.vehicleModel.toLowerCase());
    }
    
    if (vm.listingFilter.location) {
      match = match && listing.location.includes(vm.listingFilter.location);
    }
    
    if (vm.listingFilter.availability) {
      match = match && listing.availability === vm.listingFilter.availability;
    }
    
    return match;
  });
  
  // Apply sorting
  switch(vm.listingSort) {
    case 'newest':
      vm.filteredListings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
    case 'oldest':
      vm.filteredListings.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'priceAsc':
      vm.filteredListings.sort((a, b) => a.pricing.basePrice - b.pricing.basePrice);
      break;
    case 'priceDesc':
      vm.filteredListings.sort((a, b) => b.pricing.basePrice - a.pricing.basePrice);
      break;
  }
  
  vm.listings = vm.filteredListings;
  vm.listingTotalPages = Math.ceil(vm.listings.length / vm.itemsPerPage);
  vm.currentListingPage = 1;
};

vm.resetListingFilters = function() {
  vm.listingFilter = {
    vehicleModel: '',
    location: '',
    availability: ''
  };
  vm.listingSort = 'newest';
  loadListings(); // Reload original listings
};
  
  /**
   * Logs the user out of the application
   */
  function logout() {
    AuthService.logout();
  }
}