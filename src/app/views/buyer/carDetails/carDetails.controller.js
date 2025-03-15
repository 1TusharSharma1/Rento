'use strict';

angular
  .module('carRentalApp')
  .controller('CarDetailsController', CarDetailsController);

CarDetailsController.$inject = [
  '$stateParams',
  '$state',
  '$timeout',
  '$scope',
  'AuthService',
  'DbService',
  'BiddingService',
  '$uibModal' 
];

function CarDetailsController($stateParams, $state, $timeout, $scope, AuthService, DbService, BiddingService, $uibModal) {
  var vm = this;

  // Data models and defaults
  vm.car = {};
  vm.carImages = [];
  vm.highestBid = null;
  vm.isUserHasGovtId = false;

  vm.bidData = {
    bidAmount: null,
    vehicleId: null,
    bidStartDate: '',
    bidEndDate: '',
    driverLicense: '',
    isOutstation: false,
    minPrice: 0,
    minPriceOutstation: 0,
    minPriceCurrent: 0
  };

  // Public methods
  vm.init = init;
  vm.openBidModal = openBidModal;
  vm.closeBidModal = closeBidModal;
  vm.updateMinBidDisplay = updateMinBidDisplay;
  vm.placeBid = placeBid;

  /**
   * Initializes the car details view.
   * @function init
   */
  function init() {
    var carId = $stateParams.carId;
    async.waterfall([
      /**
       * Retrieves the car record.
       * @param {Function} callback - Callback to pass the car data.
       */
      function(callback) {
        DbService.getRecord('vehicles', carId)
          .then(function(carData) {
            if (!carData) {
              return callback("Car not found");
            }
            callback(null, carData);
          })
          .catch(callback);
      },
      /**
       * Sets the car data, images, and bid defaults.
       * @param {Object} carData - The car record.
       * @param {Function} callback - Callback to pass the highest bid.
       */
      function(carData, callback) {
        vm.car = carData;
        vm.carImages = carData.images_URL || [];
        vm.mainImageSrc = vm.carImages[0] || '';
        vm.setMainImage = function(imageUrl) {
          vm.mainImageSrc = imageUrl;
        };
        vm.bidData = {
          vehicleId: carData.vehicle_id,
          bidAmount: null,
          bidStartDate: '',
          bidEndDate: '',
          driverLicense: '',
          isOutstation: false,
          minPrice: Number(carData.pricing.basePrice) || 0,
          minPriceOutstation: Number(carData.pricing.outstationPrice || (carData.pricing.basePrice * 1.2)),
          minPriceCurrent: Number(carData.pricing.basePrice) || 0
        };

        BiddingService.getHighestBid(carData.vehicle_id)
          .then(function(highestBidVal) {
            callback(null, highestBidVal);
          })
          .catch(function(err) {
            // Even if this fails, continue with null
            callback(null, null);
          });
      }
    ], function(err, highestBidVal) {
      if (err) {
        console.error("Error in car details initialization:", err);
        return;
      }
      vm.highestBid = highestBidVal;
      $scope.$applyAsync();
    });
  }

  /**
   * Opens the bid modal using $uibModal.
   * @function openBidModal
   */
  function openBidModal() {
    if (vm.car.availability === 'Unavailable') {
      vm.errorMessage = "This car is not available for bidding.";
      return;
    }
    
    var currentUser = AuthService.getLoggedInUser();
    if (!currentUser) {
      vm.errorMessage = "Please log in to place a bid.";
      return;
    }

    vm.isUserHasGovtId = !!currentUser.user_govtId;
    
    // Initialize bid data before opening modal
    vm.bidData = {
      vehicleId: vm.car.vehicle_id,
      bidAmount: null,
      bidStartDate: '',
      bidEndDate: '',
      driverLicense: '',
      isOutstation: false,
      minPrice: Number(vm.car.pricing.basePrice) || 0,
      minPriceOutstation: Number(vm.car.pricing.basePriceOutstation) || 0,
      minPriceCurrent: Number(vm.car.pricing.basePrice) || 0
    };
    
    var modalInstance = $uibModal.open({
      templateUrl: 'bidModalTemplate.html',
      controller: function($scope, $uibModalInstance) {
        $scope.vm = vm; // Share the parent controller's vm
        
        $scope.closeBidModal = function() {
          $uibModalInstance.dismiss('cancel');
        };
        
        $scope.submitBid = function(bidForm) {
          if (!bidForm.$valid) {
            Object.keys(bidForm.$error).forEach(function(errorKey) {
              bidForm.$error[errorKey].forEach(function(field) {
                field.$setTouched();
              });
            });
            return;
          }

          const bidData = {
            vehicleId: vm.bidData.vehicleId,
            bidAmount: Number(vm.bidData.bidAmount),
            bidStartDate: vm.bidData.bidStartDate,
            bidEndDate: vm.bidData.bidEndDate,
            isOutstation: vm.bidData.isOutstation,
            driverLicense: vm.bidData.driverLicense
          };

          BiddingService.placeBid(bidData)
            .then(function() {
              return BiddingService.getHighestBid(bidData.vehicleId);
            })
            .then(function(highestBid) {
              vm.highestBid = highestBid;
              vm.successMessage = "Your bid has been placed successfully!";
              $uibModalInstance.close();
              
              // Get seller ID and navigate to chat
              return BiddingService.getVehicleOwner(bidData.vehicleId);
            })
            .then(function(sellerId) {
              $state.go('chat', { 
                conversationId: [currentUser.user_id, sellerId].sort().join('_') 
              });
            })
            .catch(function(error) {
              vm.errorMessage = error || "Failed to place bid. Please try again.";
            });
        };
        
        // Initialize date pickers after modal opens
        $timeout(function() {
          initDatePickers(vm.car.vehicle_id);
        });
      },
      size: 'lg'
    });
  }

  /**
   * Resets the bid data.
   * @function closeBidModal
   */
  function closeBidModal() {
    // Destroy flatpickr instances
    if (vm.datePickers) {
      if (vm.datePickers.startPicker) {
        vm.datePickers.startPicker.destroy();
      }
      if (vm.datePickers.endPicker) {
        vm.datePickers.endPicker.destroy();
      }
    }

    vm.bidData = {
      bidAmount: null,
      vehicleId: vm.car.vehicle_id,
      bidStartDate: '',
      bidEndDate: '',
      driverLicense: '',
      isOutstation: false,
      minPrice: vm.bidData.minPrice,
      minPriceOutstation: vm.bidData.minPriceOutstation,
      minPriceCurrent: vm.bidData.minPrice
    };
  }

  /**
   * Updates the minimum bid amount display based on whether the bid is for outstation.
   * @function updateMinBidDisplay
   */
  function updateMinBidDisplay() {
    vm.bidData.minPriceCurrent = vm.bidData.isOutstation
      ? vm.bidData.minPriceOutstation
      : vm.bidData.minPrice;
    
    // If current bid amount is less than new minimum, update it
    if (vm.bidData.bidAmount && vm.bidData.bidAmount < vm.bidData.minPriceCurrent) {
      vm.bidData.bidAmount = vm.bidData.minPriceCurrent;
    }
  }

  /**
   * Places a bid using the BiddingService.
   * @function placeBid
   */
  function placeBid(bidForm) {
    if (!bidForm.$valid) {
      Object.keys(bidForm.$error).forEach(function(errorKey) {
        bidForm.$error[errorKey].forEach(function(field) {
          field.$setTouched();
        });
      });
      return;
    }

    const bidData = {
      vehicleId: vm.bidData.vehicleId,
      bidAmount: Number(vm.bidData.bidAmount),
      bidStartDate: vm.bidData.bidStartDate,
      bidEndDate: vm.bidData.bidEndDate,
      isOutstation: vm.bidData.isOutstation,
      driverLicense: vm.bidData.driverLicense
    };

    BiddingService.placeBid(bidData)
      .then(function() {
        vm.closeBidModal();
        return BiddingService.getHighestBid(bidData.vehicleId);
      })
      .then(function(highestBid) {
        vm.highestBid = highestBid;
        vm.successMessage = "Your bid has been placed successfully!";
        $state.go('chat', { 
          conversationId: [AuthService.getLoggedInUser().user_id, sellerId].sort().join('_') 
        });
      })
      .catch(function(error) {
        vm.errorMessage = error || "Failed to place bid. Please try again.";
      });
  }

  /**
   * Initializes flatpickr date pickers with disabled dates based on bookings.
   * @function initDatePickers
   * @param {string} vehicleId - The vehicle's ID.
   */
  function initDatePickers(vehicleId) {
    if (!window.flatpickr) {
      console.error('Flatpickr not loaded');
      return;
    }

    getBookedDateRanges(vehicleId)
      .then(function(disabledRanges) {
        const commonConfig = {
          dateFormat: "Y-m-d",
          minDate: "today",
          disable: disabledRanges,
          allowInput: false,
          clickOpens: true,
          appendTo: document.querySelector('.modal-body'),
          static: true,
          monthSelectorType: "static"
        };

        // Initialize start date picker
        const startPicker = flatpickr(".flatpickr-wrapper #bidStartDate", {
          ...commonConfig,
          onChange: function(selectedDates) {
            if (selectedDates[0]) {
              endPicker.set('minDate', selectedDates[0]);
              vm.bidData.bidStartDate = selectedDates[0].toISOString().split('T')[0];
              $scope.$applyAsync();
            }
          }
        });

        // Initialize end date picker
        const endPicker = flatpickr(".flatpickr-wrapper #bidEndDate", {
          ...commonConfig,
          minDate: vm.bidData.bidStartDate || "today",
          onChange: function(selectedDates) {
            if (selectedDates[0]) {
              vm.bidData.bidEndDate = selectedDates[0].toISOString().split('T')[0];
              $scope.$applyAsync();
            }
          }
        });

        // Store references to destroy on modal close
        vm.datePickers = {
          startPicker: startPicker,
          endPicker: endPicker
        };
      })
      .catch(function(err) {
        console.error("Error initializing date pickers:", err);
      });
  }

  /**
   * Retrieves the date ranges during which the car is booked.
   * @function getBookedDateRanges
   * @param {string} vehicleId - The vehicle's ID.
   * @returns {Promise} A promise that resolves with an array of date ranges.
   */
  function getBookedDateRanges(vehicleId) {
    return BiddingService.loadBids()
      .then(function(bids) {
        return bids
          .filter(function(bid) {
            return bid.vehicle.vehicle_id === vehicleId && 
                   bid.bid_status === 'Accepted';
          })
          .map(function(bid) {
            return {
              from: new Date(bid.booking_start_date),
              to: new Date(bid.booking_end_date)
            };
          });
      });
  }
}
