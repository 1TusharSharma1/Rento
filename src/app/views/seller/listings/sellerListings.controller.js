'use strict';
angular
  .module('carRentalApp')
  .controller('SellerListingsController', SellerListingsController);

SellerListingsController.$inject = ['$scope', '$state', 'AuthService', 'SellerListingsService', '$timeout', '$q', '$uibModal'];

function SellerListingsController($scope, $state, AuthService, SellerListingsService, $timeout, $q, $uibModal) {
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
  vm.showModal = false; // Not used with $uibModal, but kept for legacy purposes if needed.
  vm.showOtherSuperCategory = false;
  vm.showOtherCategory = false;
  vm.selectedFiles = null;
  
  // Form input variables
  vm.newSuperCategoryName = '';
  vm.newCategoryName = '';
  vm.featureInput = '';

  // New car form model
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
    return SellerListingsService.loadListings(
      currentUser.user_id,
      vm.showUnavailable ? 'Unavailable' : 'Available'
    )
      .then(function(listings) {
        vm.listings = listings;
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
    loadListings();
  }

  function deleteListing(vehicleId) {
    SellerListingsService.deleteListing(vehicleId)
      .then(function() {
        alert("Listing marked as Unavailable!");
        vm.listings = vm.listings.filter(function(l) {
          return l.vehicle_id !== vehicleId;
        });
      })
      .catch(function(err) {
        alert("Error deleting listing: " + err);
      });
  }

  function listAgain(vehicleId) {
    SellerListingsService.listAgain(vehicleId)
      .then(function() {
        alert("Listing is now Available!");
        const found = vm.listings.find(function(l) {
          return l.vehicle_id === vehicleId;
        });
        if (found) {
          found.availability = "Available";
        }
      })
      .catch(function(err) {
        alert("Error re-listing: " + err);
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
    if (vm.newCar.superCategory === 'Other') {
      vm.showOtherSuperCategory = true;
      vm.showOtherCategory = true;
      vm.categories = [{ category_id: "Other", category_name: "Other" }];
    } else {
      vm.showOtherSuperCategory = false;
      SellerListingsService.loadCategories(vm.newCar.superCategory)
        .then(function(cats) {
          vm.categories = cats;
        })
        .catch(function(err) {
          console.error("Error loading categories:", err);
        });
    }
  }

  function onCategoryChange() {
    vm.showOtherCategory = (vm.newCar.category === 'Other');
  }

  function addFeature(feature) {
    if (!feature || !feature.trim()) return;
    vm.features.push(feature.trim());
    vm.featureInput = "";
  }

  function handleFileInput(files) {
    vm.selectedFiles = files;
  }

  function addCar() {
    const currentUser = AuthService.getLoggedInUser();
    if (!currentUser) {
      return alert("You must be logged in to add a car!");
    }

    let finalSuperCatId, finalCategoryId;

    function handleSuperCategory() {
      if (vm.newCar.superCategory === 'Other' && vm.newSuperCategoryName.trim()) {
        return SellerListingsService.getSuperCategoryByName(vm.newSuperCategoryName.trim())
          .then(function(existing) {
            if (existing) {
              return existing.supercategory_id;
            }
            return SellerListingsService.saveNewSuperCategory(vm.newSuperCategoryName.trim());
          });
      }
      return $q.resolve(vm.newCar.superCategory);
    }

    function handleCategory(superCatId) {
      finalSuperCatId = superCatId;
      if (vm.newCar.category === 'Other' && vm.newCategoryName.trim()) {
        return SellerListingsService.getCategoryByName(vm.newCategoryName.trim(), finalSuperCatId)
          .then(function(existingCat) {
            if (existingCat) {
              return existingCat.category_id;
            }
            return SellerListingsService.saveNewCategory(vm.newCategoryName.trim(), finalSuperCatId);
          });
      }
      return $q.resolve(vm.newCar.category);
    }

    handleSuperCategory()
      .then(handleCategory)
      .then(function(categoryId) {
        finalCategoryId = categoryId;
        vm.newCar.superCategory = finalSuperCatId;
        vm.newCar.category = finalCategoryId;
        vm.newCar.features = vm.features.join(", ");
        
        return SellerListingsService.addCar(vm.newCar, vm.selectedFiles);
      })
      .then(function(savedVehicle) {
        vm.listings.push(savedVehicle);
        alert("Car added successfully!");
        // vm.showModal is no longer used with $uibModal
        resetForm();
      })
      .catch(function(err) {
        console.error("Error adding car:", err);
        alert("Error: " + err);
      });
  }

  function initNewCarForm() {
    const currentUser = AuthService.getLoggedInUser();
    
    // Initialize the newCar object
    vm.newCar = {
      vehicleModel: '',
      vehicleNumber: '',
      basePrice: null,
      basePriceOutstation: null,
      superCategory: '',
      category: '',
      location: '',
      features: '',
      vehicle_owner_id: currentUser.user_id,
      owner: {
        user_id: currentUser.user_id,
        first_name: currentUser.first_name || currentUser.username,
        email: currentUser.email,
        photoURL: currentUser.photoURL
      },
      imageFiles: null
    };
  }
}
