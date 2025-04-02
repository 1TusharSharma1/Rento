angular.module('carRentalApp')
  .controller('BuyerHomeController', BuyerHomeController);

BuyerHomeController.$inject = ['$http', 'DbService', '$window', '$timeout', '$state', '$q'];

function BuyerHomeController($http, DbService, $window, $timeout, $state, $q) {
  const vm = this;
  const API_BASE_URL = 'http://localhost:5050/api/v1';
  
  vm.allVehicles = [];   // Contains all the vehicles fetched from the database.
  vm.vehicles = [];      // Contains the filtered vehicles
  vm.superCategories = []; // Available super categories
  vm.categories = [];    // Available categories
  vm.filters = {
    superCategory: '',
    category: '',
    location: '',
    minPrice: null,
    maxPrice: null,
    availability: '',
    sortBy: 'newest'
  };

  vm.openVehicleDetails = openVehicleDetails;
  vm.applyFilters = applyFilters;
  vm.onSuperCategoryChange = onSuperCategoryChange;
  vm.init = init;


  /**
   * Initializes the controller by fetching all vehicle records from the API
   * and setting up the initial vehicle list.
   * @returns {Promise} - Promise that resolves when initialization is complete
   */
  function init() {
    return $q.all([
      // Load vehicles
      $http({
        method: 'GET',
        url: `${API_BASE_URL}/vehicles`,
        params: {
          status: 'available'
        }
      }),
      // Load super categories
      $http({
        method: 'GET',
        url: `${API_BASE_URL}/vehicles/supercategories`
      })
    ])
    .then(function(responses) {
      const vehiclesResponse = responses[0];
      const superCategoriesResponse = responses[1];

      // Process vehicles
      const vehiclesData = vehiclesResponse.data.data.vehicles || [];
      
      // Transform the backend vehicle format to match the frontend expected format
      vm.allVehicles = vehiclesData.map(function(vehicle) {
        return {
          vehicle_id: vehicle._id,
          vehicleModel: vehicle.title,
          vehicleNumber: vehicle.description,
          vehicle_owner_id: vehicle.owner,
          owner: vehicle.owner_details,
          images_URL: vehicle.images,
          pricing: vehicle.pricing,
          superCategory: vehicle.supercategory_name,
          category: vehicle.category_name,
          features: vehicle.features,
          location: vehicle.location,
          availability: vehicle.status,
          created_at: vehicle.createdAt,
          uploaded_at: vehicle.createdAt
        };
      });
      
      vm.vehicles = angular.copy(vm.allVehicles);
      
      // Process super categories
      vm.superCategories = superCategoriesResponse.data.data || [];
      
      $timeout(function() {});
      return vm.vehicles;
    })
    .catch(function(error) {
      console.error('Error loading vehicles:', error);
      
      // Fallback to IndexedDB if API fails
      return DbService.getAllRecords("vehicles")
        .then(function(vehicles) {
          // Filter only available vehicles
          vm.allVehicles = vehicles.filter(vehicle => vehicle.availability === "Available");
          vm.vehicles = angular.copy(vm.allVehicles);
          $timeout(function() {});
          return vehicles;
        });
    });
  }

  /**
   * When the super category is changed, load the related categories
   */
  function onSuperCategoryChange() {
    if (!vm.filters.superCategory) {
      vm.categories = [];
      vm.filters.category = '';
      return;
    }
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles/categories`,
      params: {
        supercategory_name: vm.filters.superCategory
      }
    })
    .then(function(response) {
      vm.categories = response.data.data || [];
    })
    .catch(function(error) {
      console.error('Error loading categories:', error);
      vm.categories = [];
    });
  }

  /**
   * Filters the vehicles based on the criteria selected by the user.
   * If possible, uses the backend API for filtering; otherwise falls back to client-side filtering.
   */
  function applyFilters() {
    // Try to use the backend API for filtering
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles`,
      params: {
        supercategory_name: vm.filters.superCategory || undefined,
        category_name: vm.filters.category || undefined,
        location: vm.filters.location || undefined,
        minPrice: vm.filters.minPrice || undefined,
        maxPrice: vm.filters.maxPrice || undefined,
        status: 'available'
      }
    })
    .then(function(response) {
      const vehiclesData = response.data.data.vehicles || [];
      
      // Transform the backend vehicle format to match the frontend expected format
      vm.vehicles = vehiclesData.map(function(vehicle) {
        return {
          vehicle_id: vehicle._id,
          vehicleModel: vehicle.title,
          vehicleNumber: vehicle.description,
          vehicle_owner_id: vehicle.owner,
          owner: vehicle.owner_details,
          images_URL: vehicle.images,
          pricing: vehicle.pricing,
          superCategory: vehicle.supercategory_name,
          category: vehicle.category_name,
          features: vehicle.features,
          location: vehicle.location,
          availability: vehicle.status,
          created_at: vehicle.createdAt,
          uploaded_at: vehicle.createdAt
        };
      });
      
      // Apply sorting (this is still client-side as the API might not support it)
      applySorting();
    })
    .catch(function(error) {
      console.error('Error applying filters with API:', error);
      
      // Fallback to client-side filtering
      clientSideFiltering();
    });
  }
  
  /**
   * Applies filters on the client side
   */
  function clientSideFiltering() {
    vm.vehicles = vm.allVehicles.filter(function(vehicle) {
      let pass = true;
      if (vm.filters.superCategory) {
        pass = pass && (vehicle.superCategory === vm.filters.superCategory);
      }
      if (vm.filters.category) {
        pass = pass && (vehicle.category === vm.filters.category);
      }
      if (vm.filters.location) {
        pass = pass && (vehicle.location.toLowerCase().indexOf(vm.filters.location.toLowerCase()) !== -1);
      }
      if (vm.filters.minPrice != null && vm.filters.minPrice !== '') {
        pass = pass && (Number(vehicle.pricing.basePrice) >= Number(vm.filters.minPrice));
      }
      if (vm.filters.maxPrice != null && vm.filters.maxPrice !== '') {
        pass = pass && (Number(vehicle.pricing.basePrice) <= Number(vm.filters.maxPrice));
      }
      return pass;
    });
    
    applySorting();
  }
  
  /**
   * Applies sorting to the filtered vehicles
   */
  function applySorting() {
    if (vm.filters.sortBy === 'priceLowHigh') {
      vm.vehicles.sort(function(a, b) {
        return Number(a.pricing.basePrice) - Number(b.pricing.basePrice);
      });
    } else if (vm.filters.sortBy === 'priceHighLow') {
      vm.vehicles.sort(function(a, b) {
        return Number(b.pricing.basePrice) - Number(a.pricing.basePrice);
      });
    } else if (vm.filters.sortBy === 'newest') {
      vm.vehicles.sort(function(a, b) {
        return new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at);
      });
    }
  }

  /**
   * Navigates to the vehicle details page for the selected vehicle
   * @param {Object} vehicle - The vehicle object to display details for
   */
  function openVehicleDetails(vehicle) {
    $state.go('carDetails', { carId: vehicle.vehicle_id });
  }
}
