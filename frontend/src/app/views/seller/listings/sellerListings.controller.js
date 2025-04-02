'use strict';
angular
  .module('carRentalApp')
  .controller('SellerListingsController', SellerListingsController);

SellerListingsController.$inject = ['$scope', '$state', 'AuthService', 'SellerListingsService', 'VehicleFactory', '$timeout', '$q', '$uibModal'];

function SellerListingsController($scope, $state, AuthService, SellerListingsService, VehicleFactory, $timeout, $q, $uibModal) {
  // View model reference
  const vm = this;

  // ========================================================================
  // Controller variables
  // ========================================================================
  
  // Data storage
  vm.listings = [];
  vm.superCategories = [];
  vm.categories = [];
  vm.features = [];

  // UI control flags
  vm.showUnavailable = false;
  vm.showModal = false;
  vm.showOtherSuperCategory = false;
  vm.showOtherCategory = false;
  vm.selectedFiles = null;
  
  // Form input variables
  vm.newSuperCategoryName = '';
  vm.newCategoryName = '';
  vm.featureInput = '';

  // New car form model - this will be converted to a Vehicle instance during submission
  vm.newCar = {
    vehicleModel: '',
    vehicleNumber: '',
    basePrice: null,
    basePriceOutstation: null,
    superCategory: '',
    category: '',
    location: '',
    features: '',
    vehicle_owner_id: '',
    owner: null,
    imageFiles: null
  };

  vm.init = init;                       // Initialize controller (should be called with ng-init in HTML)
  vm.toggleAvailability = toggleAvailability;  // Switch between available/unavailable listings
  vm.deleteListing = deleteListing;     // Mark a listing as unavailable
  vm.listAgain = listAgain;             // Make an unavailable listing available again
  vm.openModal = openModal;             // Open the 'Add Car' modal
  vm.closeModal = closeModal;           // Close the 'Add Car' modal (not used with $uibModal)
  vm.onSuperCategoryChange = onSuperCategoryChange;  // Handle super category selection change
  vm.onCategoryChange = onCategoryChange;            // Handle category selection change
  vm.addFeature = addFeature;           // Add a feature to the features list
  vm.removeFeature = removeFeature;     // Remove a feature from the features list
  vm.addCar = addCar;                   // Submit the new car form
  vm.handleFileInput = handleFileInput; // Process selected image files

  // ------------------------------------------------------------------------
  // Controller initialization
  // ------------------------------------------------------------------------
  function init() {
    const currentUser = AuthService.getLoggedInUser();
    if (!currentUser) {
      return $state.go('login');
    }
    return loadListings();
  }

  // ------------------------------------------------------------------------
  // Data loading functions.
  // ------------------------------------------------------------------------
  function loadListings() {
    const currentUser = AuthService.getLoggedInUser();
    
    console.log('Controller loadListings - showUnavailable:', vm.showUnavailable);
    
    return SellerListingsService.loadListings(
      currentUser.user_id,
      vm.showUnavailable ? 'unavailable' : 'available'
    )
      .then(function(vehiclesData) {
        console.log('Controller received vehicle data:', vehiclesData);
        // Use VehicleFactory to create vehicle instances
        vm.listings = VehicleFactory.createVehicleArray(vehiclesData);
        console.log('Controller created vehicle instances:', vm.listings);
        $timeout(); 
      })
      .catch(function(err) {
        console.error("Error loading listings:", err);
      });
  }

  // ------------------------------------------------------------------------
  // Listing management functions
  // ------------------------------------------------------------------------
  function toggleAvailability(showUnavailable) {
    vm.showUnavailable = showUnavailable;
    loadListings().then(function() {
      // Show feedback to user about which listings they're viewing
      if (vm.listings.length === 0) {
        if (showUnavailable) {
          console.log('No unavailable listings found');
        } else {
          console.log('No available listings found');
        }
      }
    });
  }

  function deleteListing(vehicleId) {
    console.log('Controller deleteListing for vehicle ID:', vehicleId);
    
    if (!confirm("Are you sure you want to delist this vehicle? It will no longer be visible to customers but you can re-list it later.")) {
      return;
    }
    
    SellerListingsService.deleteListing(vehicleId)
      .then(function(updatedVehicleData) {
        console.log('Vehicle marked as unavailable:', updatedVehicleData);
        
        // Create a Vehicle instance from the API response
        const updatedVehicle = VehicleFactory.createVehicle(updatedVehicleData);
        
        // Update the vehicle in the listings array
        const index = vm.listings.findIndex(v => v.vehicle_id === updatedVehicle.vehicle_id);
        if (index !== -1) {
          vm.listings[index] = updatedVehicle;
        }
        
        alert("Vehicle has been successfully delisted!");
        
        // Refresh listings to get updated data
        loadListings();
      })
      .catch(function(err) {
        console.error("Failed to delist vehicle:", err);
        
        // Provide a more helpful error message to the user
        let errorMessage = "Failed to delist vehicle. ";
        
        if (err && typeof err === 'string') {
          errorMessage += err;
        } else if (err && err.message) {
          errorMessage += err.message;
        } else {
          errorMessage += "Please try again later.";
        }
        
        alert(errorMessage);
      });
  }

  function listAgain(vehicleId) {
    console.log('Controller listAgain for vehicle ID:', vehicleId);
    
    if (!confirm("Do you want to make this vehicle available again? It will be visible to customers.")) {
      return;
    }
    
    SellerListingsService.listAgain(vehicleId)
      .then(function(updatedVehicleData) {
        console.log('Vehicle marked available:', updatedVehicleData);
        
        // Create a Vehicle instance from the API response
        const updatedVehicle = VehicleFactory.createVehicle(updatedVehicleData);
        
        // Update the vehicle in the listings array
        const index = vm.listings.findIndex(v => v.vehicle_id === updatedVehicle.vehicle_id);
        if (index !== -1) {
          vm.listings[index] = updatedVehicle;
        }
        
        alert("Vehicle is now listed and available to customers!");
        
        // Refresh listings to get updated data
        loadListings();
      })
      .catch(function(err) {
        console.error("Failed to relist vehicle:", err);
        
        // Provide a more helpful error message to the user
        let errorMessage = "Failed to make vehicle available. ";
        
        if (err && typeof err === 'string') {
          errorMessage += err;
        } else if (err && err.message) {
          errorMessage += err.message;
        } else {
          errorMessage += "Please try again later.";
        }
        
        alert(errorMessage);
      });
  }

  // ------------------------------------------------------------------------
  // Modal and form handling for Adding a New Car
  // ------------------------------------------------------------------------
  function openModal() {
    initNewCarForm();
    
    // Load any necessary data (e.g., super categories)
    SellerListingsService.loadSuperCategories()
      .then(function(scs) {
        vm.superCategories = scs;
        
        // Open the modal using the inline template defined in the script tag
        $uibModal.open({
          templateUrl: 'addCarModal.html',
          controller: function($scope, $uibModalInstance) {
            $scope.vm = vm; // Expose the parent controller's vm in the modal scope

            // Function to close the modal
            $scope.close = function() {
              $uibModalInstance.dismiss('cancel');
              resetForm();
            };

            // Function to add the car and close the modal upon success
            $scope.addCar = function() {
              vm.addCar().then(function() {
                $uibModalInstance.close();
              });
            };
          },
          size: 'lg'
        });
      })
      .catch(function(err) {
        console.error("Error loading super categories:", err);
      });
  }

  function closeModal() {
    vm.showModal = false;
    resetForm();
  }

  function resetForm() {
    vm.newCar = {
      vehicleModel: '',
      vehicleNumber: '',
      basePrice: null,
      basePriceOutstation: null,
      superCategory: '',
      category: '',
      location: '',
      features: '',
      vehicle_owner_id: vm.newCar.vehicle_owner_id,
      owner: vm.newCar.owner,
      imageFiles: null
    };
    vm.features = [];
    vm.selectedFiles = null;
    vm.showOtherSuperCategory = false;
    vm.showOtherCategory = false;
    vm.newSuperCategoryName = '';
    vm.newCategoryName = '';
  }

  function onSuperCategoryChange() {
    console.log('Selected supercategory:', vm.newCar.superCategory);
    
    if (vm.newCar.superCategory === 'Other') {
      vm.showOtherSuperCategory = true;
      vm.showOtherCategory = true;
      vm.categories = [{ category_id: "Other", category_name: "Other" }];
    } else {
      vm.showOtherSuperCategory = false;
      
      // Load categories for the selected super category
      SellerListingsService.loadCategories(vm.newCar.superCategory)
        .then(function(cats) {
          vm.categories = cats;
          
          // Add "Other" option if not already in the list
          if (!vm.categories.some(c => c.category_name === 'Other')) {
            vm.categories.push({ category_id: "Other", category_name: "Other" });
          }
        })
        .catch(function(err) {
          console.error("Error loading categories:", err);
          vm.categories = [{ category_id: "Other", category_name: "Other" }];
        });
    }
    
    // Reset category selection when super category changes
    vm.newCar.category = '';
    vm.showOtherCategory = false;
  }

  function onCategoryChange() {
    vm.showOtherCategory = vm.newCar.category === 'Other';
  }

  function addFeature(feature) {
    if (feature && feature.trim() !== '' && !vm.features.includes(feature)) {
      vm.features.push(feature);
      vm.featureInput = '';
    }
  }

  function removeFeature(index) {
    vm.features.splice(index, 1);
  }

  function handleFileInput(files) {
    vm.selectedFiles = files;
  }

  function validateCarForm() {
    const errors = [];
    
    // Use VehicleFactory for validation of a new vehicle
    const vehicleData = {
      vehicleModel: vm.newCar.vehicleModel,
      vehicleNumber: vm.newCar.vehicleNumber,
      pricing: {
        basePrice: vm.newCar.basePrice,
        basePriceOutstation: vm.newCar.basePriceOutstation || vm.newCar.basePrice
      },
      location: vm.newCar.location,
      owner: vm.newCar.owner || AuthService.getLoggedInUser().user_id,
      superCategory: vm.showOtherSuperCategory ? vm.newSuperCategoryName : vm.newCar.superCategory,
      category: vm.showOtherCategory ? vm.newCategoryName : vm.newCar.category,
      features: vm.features
    };
    
    // Create a temporary vehicle instance for validation
    const tempVehicle = VehicleFactory.createVehicle(vehicleData);
    
    // Required fields
    if (!tempVehicle.vehicleModel) {
      errors.push("Vehicle model/name is required");
    }
    
    if (!tempVehicle.vehicleNumber) {
      errors.push("Vehicle number is required");
    }
    
    if (!tempVehicle.pricing.basePrice) {
      errors.push("Base price is required");
    } else if (isNaN(parseFloat(tempVehicle.pricing.basePrice)) || parseFloat(tempVehicle.pricing.basePrice) <= 0) {
      errors.push("Base price must be a positive number");
    }
    
    if (tempVehicle.pricing.basePriceOutstation && (isNaN(parseFloat(tempVehicle.pricing.basePriceOutstation)) || parseFloat(tempVehicle.pricing.basePriceOutstation) <= 0)) {
      errors.push("Outstation price must be a positive number");
    }
    
    if (!tempVehicle.location) {
      errors.push("Location is required");
    }
    
    // Super category and category validation
    if (vm.showOtherSuperCategory) {
      if (!vm.newSuperCategoryName) {
        errors.push("New category type name is required");
      }
    } else if (!tempVehicle.superCategory) {
      errors.push("Category type is required");
    }
    
    if (vm.showOtherCategory) {
      if (!vm.newCategoryName) {
        errors.push("New category name is required");
      }
    } else if (!tempVehicle.category) {
      errors.push("Category is required");
    }
    
    // Image validation
    if (!vm.selectedFiles || vm.selectedFiles.length === 0) {
      errors.push("At least one image is required");
    }
    
    return errors;
  }

  function addCar() {
    const errors = validateCarForm();
    
    if (errors.length > 0) {
      alert("Please fix the following errors:\n" + errors.join("\n"));
      return $q.reject(errors);
    }
    
    // Set up promises for potential new categories
    let superCategoryPromise = $q.resolve(vm.newCar.superCategory);
    let categoryPromise = $q.resolve(vm.newCar.category);
    
    // Handle custom super category if needed
    if (vm.showOtherSuperCategory && vm.newSuperCategoryName) {
      superCategoryPromise = SellerListingsService.saveNewSuperCategory(vm.newSuperCategoryName)
        .then(function(newSuperCat) {
          return newSuperCat.superCategory_name;
        });
    }
    
    // First resolve super category, then handle category
    return superCategoryPromise
      .then(function(resolvedSuperCategory) {
        // Handle custom category if needed
        if (vm.showOtherCategory && vm.newCategoryName) {
          return SellerListingsService.saveNewCategory(vm.newCategoryName, resolvedSuperCategory)
            .then(function(newCat) {
              return {
                superCategory: resolvedSuperCategory,
                category: newCat.category_name
              };
            });
        } else {
          return {
            superCategory: resolvedSuperCategory,
            category: vm.newCar.category
          };
        }
      })
      .then(function(categories) {
        // Prepare the vehicle data object
        const user = AuthService.getLoggedInUser();
        
        // Create the vehicle object using VehicleFactory
        const vehicleData = {
          title: vm.newCar.vehicleModel,
          description: vm.newCar.vehicleNumber,
          pricing: {
            basePrice: Number(vm.newCar.basePrice),
            basePriceOutstation: Number(vm.newCar.basePriceOutstation || vm.newCar.basePrice)
          },
          location: vm.newCar.location,
          owner: user._id,
          supercategory_name: categories.superCategory,
          category_name: categories.category,
          features: vm.features
        };
        
        // Create proper Vehicle instance using the factory
        const vehicle = VehicleFactory.createVehicle(vehicleData);
        
        // Submit to service - pass the vehicle data and files
        return SellerListingsService.addCar(vehicle, vm.selectedFiles)
          .then(function(newVehicleData) {
            // Create a proper Vehicle instance from the API response
            const newVehicle = VehicleFactory.createVehicle(newVehicleData);
            
            // Add to the listings array and reset the form
            vm.listings.unshift(newVehicle);
            resetForm();
            
            alert("Vehicle has been successfully added!");
            return newVehicle;
          });
      })
      .catch(function(error) {
        console.error("Error in addCar:", error);
        alert("Error adding car: " + (typeof error === 'string' ? error : "Please try again"));
        return $q.reject(error);
      });
  }

  function initNewCarForm() {
    const user = AuthService.getLoggedInUser();
    
    vm.newCar = {
      vehicleModel: '',
      vehicleNumber: '',
      basePrice: null,
      basePriceOutstation: null,
      superCategory: '',
      category: '',
      location: user && user.address ? user.address.city : '',
      features: '',
      vehicle_owner_id: user ? user.user_id : '',
      owner: user ? user.user_id : null,
      imageFiles: null
    };
    
    vm.features = [];
    vm.categories = [];
    vm.selectedFiles = null;
    vm.showOtherSuperCategory = false;
    vm.showOtherCategory = false;
  }
}
