angular.module('carRentalApp')
  .controller('BuyerHomeController', BuyerHomeController);

BuyerHomeController.$inject = ['DbService', '$window', '$timeout', '$state', '$q'];

function BuyerHomeController(DbService, $window, $timeout, $state, $q) {
  const vm = this;
  vm.allVehicles = [];   // Contains all the vehicles fetched from the database.
  vm.vehicles = [];        // Contains the filtered vehicles
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
  vm.init = init;


  /**
   * Initializes the controller by fetching all vehicle records from the database
   * and setting up the initial vehicle list.
   * @returns {Promise} - Promise that resolves when initialization is complete
   */
  function init() {
    return DbService.getAllRecords("vehicles")
      .then(function(vehicles) {
        // Filter only available vehicles
        vm.allVehicles = vehicles.filter(vehicle => vehicle.availability === "Available");
        vm.vehicles = angular.copy(vm.allVehicles);
        $timeout(function() {});
        return vehicles;
      })
      .catch(function(error) {
        console.error('Error loading vehicles:', error);
        return $q.reject(error);
      });
  }

  /**
   * Filters the vehicles based on the criteria selected by the user.
   * Applies filtering on category, location, price range, and availability.
   * Also handles sorting based on the selected sort option.
   */
  function applyFilters() {
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
      if (vm.filters.availability) {
        pass = pass && (vehicle.availability === vm.filters.availability);
      }
      return pass;
    });

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
        return new Date(b.uploaded_at) - new Date(a.uploaded_at);
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
