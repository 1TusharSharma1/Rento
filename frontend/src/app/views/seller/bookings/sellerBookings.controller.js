"use strict";

angular
  .module("carRentalApp")
  .controller("SellerBookingsController", SellerBookingsController);

SellerBookingsController.$inject = [
  "$scope",
  "BookingService",
  "BookingFactory",
  "AuthService",
  "DbService",
  "$state",
  "$q",
  "$uibModal"
];

function SellerBookingsController(
  $scope,
  BookingService,
  BookingFactory,
  AuthService,
  DbService,
  $state,
  $q,
  $uibModal
) {
  console.log("SellerBookingsController instantiated");

  // Controller instance
  const vm = this;

  /**
   * Controller Variables
   * All variables defined at the top for better readability
   */

  // User and state information
  vm.userProfile = null;
  vm.loading = true;
  vm.error = null;
  vm.bids = [];

  // Analytics dashboard data
  vm.analytics = {
    totalVehicles: 0,
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
  };

  // Booking list and pagination
  vm.bookings = [];
  vm.currentView = "pending"; // default view: "Not Started" bookings (pending status)
  vm.pagination = {
    itemsPerPage: 15,
    currentPage: 1,
    totalPages: 1,
    pages: []
  };

  /**
   * Controller Functions
   * Bindable methods for UI interaction
   */
  vm.init = init;
  vm.loadAnalytics = loadAnalytics;
  vm.loadBookings = loadBookings;
  vm.changeView = changeView;
  vm.renderPage = renderPage;
  vm.goToPage = goToPage;
  vm.startTrip = startTrip;
  vm.endTrip = endTrip;
  vm.viewReceipt = viewReceipt;
  vm.downloadReceipt = downloadReceipt;
  vm.updateBookingStatus = updateBookingStatus;
  
  // Track if a booking operation is in progress to prevent duplicate calls
  let bookingOperationInProgress = false;

  // Initialize automatically when controller is instantiated
  // Use ng-init="vm.init()" in the view template for proper initialization
  

  // Initialization


  /**
   * Initialize the controller
   * Verifies user permissions and loads initial data
   */
  function init() {
    console.log("Init function called");
    vm.loading = true;
    
    // Force a fresh check with the server for authentication
    AuthService.getCurrentUser()
      .then(function(user) {
        console.log("User Profile:", user);
        vm.userProfile = user;
        
        // Check if user exists and has seller role
        if (!vm.userProfile || !vm.userProfile.user_role || !vm.userProfile.user_role.includes("seller")) {
          console.error("Invalid user or not a seller");
          $state.go("login");
          return $q.reject("Not authorized as seller");
        }

        return DbService.isReady;
      })
      .then(function() {
        console.log("Database ready, loading bookings...");
        return loadBookings();
      })
      .catch(function(error) {
        console.error("Error during initialization:", error);
        
        if (error === "Not authenticated" || error === "Not authorized as seller") {
          $state.go("login");
        } else {
          vm.error = "Failed to initialize. Please refresh the page.";
        }
        return $q.reject(error);
      })
      .finally(function() {
        vm.loading = false;
      });
  }

  /////////////////////////
  // Analytics
  /////////////////////////

  /**
   * Load seller analytics data
   * Retrieves vehicle count and booking statistics
   * @returns {Promise} Promise resolving when analytics are loaded
   */
  function loadAnalytics() {
    const seller = AuthService.getLoggedInUser();
    const sellerId = String(seller.user_id);
    const deferred = $q.defer();

    // NOMOREINUSE -->  Count vehicles for this seller using the index
    DbService.getIndex("vehicles", "vehicle_owner_id", "readonly")
      .then(function (index) {
        return $q(function (resolve, reject) {
          const request = index.getAll(sellerId);
          request.onsuccess = function (event) {
            resolve(event.target.result.length);
          };
          request.onerror = function (event) {
            reject(event.target.error);
          };
        });
      })
      .then(function (vehicleCount) {
        console.log('Getting in here' , vm.analytics.totalVehicles);
        vm.analytics.totalVehicles = vehicleCount;
      })
      .catch(function (err) {
        console.error("Error loading vehicle analytics:", err);
        deferred.reject(err);
      });

    DbService.getStore("bookings", "readonly")
      .then(function (store) {
        return $q(function (resolve, reject) {
          const req = store.getAll();
          req.onsuccess = function (event) {
            const bookings = event.target.result || [];
            let total = 0,
              upcoming = 0,
              completed = 0;
            const today = new Date();
            console.log('Gettingggg in here!')
            // Create booking objects using BookingFactory for consistent status checks
            const bookingObjects = BookingFactory.createBookingArray(bookings);
            bookingObjects.forEach(function (booking) {
              if (
                booking.seller &&
                String(booking.seller.user_id) === sellerId
              ) {
                total++;
                const startDate = new Date(booking.booking_start_date);
                
                if (booking.isConfirmed() && startDate > today) {
                  upcoming++;
                } else if (booking.isCompleted()) {
                  completed++;
                }
              }
            });

            resolve({ total: total, upcoming: upcoming, completed: completed });
          };
          req.onerror = function (event) {
            reject(event.target.error);
          };
        });
      })
      .then(function (analytics) {
        vm.analytics.totalBookings = analytics.total;
        vm.analytics.upcomingBookings = analytics.upcoming;
        vm.analytics.completedBookings = analytics.completed;
        deferred.resolve();
      })
      .catch(function (err) {
        console.error("Error loading booking analytics:", err);
        deferred.reject(err);
      });

    return deferred.promise;
  }


  // Load Bookings


  /**
   * Load bookings for the current seller with server-side pagination
   * @returns {Promise} Promise resolving when bookings are loaded
   */
  function loadBookings() {
    console.log("[SellerBookingsController] LoadBookings called");
    
    // Don't load if operation already in progress
    if (bookingOperationInProgress) {
      console.log("[SellerBookingsController] Booking operation already in progress, skipping");
      return $q.resolve();
    }
    
    vm.loading = true;
    vm.error = null;
    bookingOperationInProgress = true;
    
    return BookingService.getSellerBookings(
      vm.currentView, 
      vm.pagination.currentPage, 
      vm.pagination.itemsPerPage
    )
      .then(function(response) {
        console.log("[SellerBookingsController] Bookings loaded successfully:", response);
        
        // Use BookingFactory to create proper booking objects
        if (response && response.data) {
          // Handle both direct data array and nested data structure
          const bookingsData = Array.isArray(response.data) ? response.data : response.data;
          console.log("[SellerBookingsController] Processing bookings data:", bookingsData);
          
          vm.bookings = BookingFactory.createBookingArray(bookingsData);
          console.log("[SellerBookingsController] Created booking objects:", vm.bookings);
          
          // Update pagination info
        if (response.pagination) {
            vm.pagination.totalPages = response.pagination.totalPages || 1;
            vm.pagination.currentPage = response.pagination.page || 1;
            
            // Generate page numbers for pagination UI
            vm.renderPage();
          }
        } else {
          console.warn("[SellerBookingsController] No bookings data found in response");
          vm.bookings = [];
          vm.pagination.totalPages = 1;
          vm.pagination.currentPage = 1;
          vm.renderPage();
        }
        
        // Load analytics in the background
        loadAnalytics();
        
        return vm.bookings;
      })
      .catch(function(error) {
        console.error("[SellerBookingsController] Error loading bookings:", error);
        vm.error = typeof error === 'string' ? error : "Failed to load bookings. Please try again.";
        return $q.reject(error);
      })
      .finally(function() {
        vm.loading = false;
        bookingOperationInProgress = false;
      });
  }

  /**
   * Change the current view (filter) and reload bookings
   * @param {string} view - The view/status to filter by
   */
  function changeView(view) {
    console.log("[SellerBookingsController] Changing view to:", view);
    vm.currentView = view;
    vm.pagination.currentPage = 1; // Reset to first page
    return loadBookings();
  }

  /**
   * Generate page numbers for pagination UI
   */
  function renderPage() {
    vm.pagination.pages = [];
    for (let i = 1; i <= vm.pagination.totalPages; i++) {
      vm.pagination.pages.push(i);
    }
  }

  /**
   * Navigate to a specific page and load bookings
   * @param {number} page - The page number to navigate to
   */
  function goToPage(page) {
    if (page < 1 || page > vm.pagination.totalPages) {
      return;
    }
    
    vm.pagination.currentPage = page;
    return loadBookings();
  }

  /**
   * Start a trip for a booking
   * @param {Object} booking - The booking to start
   */
  function startTrip(booking) {
    if (bookingOperationInProgress) {
      return;
    }
    
    // Check if booking is in pending status rather than using isConfirmed()
    if (booking.status !== 'pending') {
      vm.error = "Only pending bookings can be started";
      return;
    }
    
    // Open modal with inline controller and template
    const modalInstance = $uibModal.open({
      controller: function($scope, $uibModalInstance) {
        const modalVm = this;
        modalVm.initialOdometer = 0;
        
        modalVm.submitStartTrip = function() {
          if (modalVm.initialOdometer === undefined || modalVm.initialOdometer === null) {
            $scope.error = "Please enter an odometer reading";
              return;
            }
            
          // Parse as float to ensure numeric value
          const odometerValue = parseFloat(modalVm.initialOdometer);
          if (isNaN(odometerValue) || odometerValue < 0) {
            $scope.error = "Please enter a valid odometer reading";
              return;
            }
            
          $uibModalInstance.close(odometerValue);
        };
      },
      controllerAs: 'modal',
      size: 'md',
      template: `
        <div class="modal-header">
          <button type="button" class="close" ng-click="$dismiss()">&times;</button>
          <h4 class="modal-title"><i class="glyphicon glyphicon-road"></i> Start Trip</h4>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" ng-if="error">{{error}}</div>
          <div class="form-group">
            <label>Initial Odometer Reading</label>
            <div class="input-group">
              <input type="number" class="form-control" ng-model="modal.initialOdometer" 
                    placeholder="Initial Odometer" min="0" required>
              <span class="input-group-addon">km</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" ng-click="$dismiss()">Cancel</button>
          <button class="btn btn-success" ng-click="modal.submitStartTrip()">
            <i class="glyphicon glyphicon-play"></i> Start Trip
          </button>
        </div>
      `
    });
    
    modalInstance.result.then(function(odometerReading) {
      vm.loading = true;
            bookingOperationInProgress = true;
            
      console.log("[SellerBookingsController] Starting trip with odometer reading:", odometerReading);
      
      // Store the reading locally as a backup
      try {
        localStorage.setItem(`booking_${booking.booking_id}_initial_odometer`, odometerReading.toString());
      } catch (e) {
        console.warn("[SellerBookingsController] Could not save initial odometer to localStorage:", e);
      }
      
      // Make direct API call to the BookingService startTrip method
      BookingService.startTrip(booking.booking_id, odometerReading)
        .then(function(updatedBookingData) {
          console.log("[SellerBookingsController] Trip started successfully:", updatedBookingData);
          
          // Verify the initial_odometer_reading was stored
          if (updatedBookingData.initial_odometer_reading === undefined || 
              updatedBookingData.initial_odometer_reading === null ||
              isNaN(parseFloat(updatedBookingData.initial_odometer_reading))) {
            console.warn("[SellerBookingsController] Initial odometer reading not stored in response");
          } else {
            console.log("[SellerBookingsController] Initial odometer reading stored:", updatedBookingData.initial_odometer_reading);
          }
          
          // Create a booking instance from the response
          const updatedBooking = BookingFactory.createBooking(updatedBookingData);
          console.log("[SellerBookingsController] Created booking object after trip start:", updatedBooking);
          
          // Show confirmation message
          alert(`Trip started successfully! Initial odometer reading: ${odometerReading} km`);
          
          // Refresh the bookings list to reflect the status change
                return loadBookings();
              })
        .catch(function(error) {
          console.error("[SellerBookingsController] Error starting trip:", error);
          vm.error = typeof error === 'string' ? error : "Failed to start trip. Please try again.";
              })
              .finally(function() {
          vm.loading = false;
                bookingOperationInProgress = false;
              });
    });
  }

  /**
   * End a trip for a booking
   * @param {Object} booking - The booking to end
   */
  function endTrip(booking) {
    if (bookingOperationInProgress) {
      return;
    }
    
    // Check raw status value instead of using isInProgress()
    if (booking.status !== 'in_progress') {
      vm.error = "Only in-progress bookings can be ended";
              return;
            }
            
    // Debug the booking object to see its structure
    console.log("[SellerBookingsController] Full booking object:", JSON.stringify(booking));
    
    // Try multiple sources to get the initial odometer reading
    let initialReading = 0;
    
    // 1. First try from the booking object directly
    if (typeof booking.initial_odometer_reading === 'number') {
      initialReading = booking.initial_odometer_reading;
      console.log("[SellerBookingsController] Using initial odometer reading from booking object:", initialReading);
    } else if (booking.initial_odometer_reading) {
      initialReading = parseFloat(booking.initial_odometer_reading);
      console.log("[SellerBookingsController] Parsed initial odometer reading from booking object:", initialReading);
    } 
    // 2. If not found or invalid, try from localStorage
    else {
      try {
        const storedReading = localStorage.getItem(`booking_${booking.booking_id}_initial_odometer`);
        if (storedReading) {
          initialReading = parseFloat(storedReading);
          console.log("[SellerBookingsController] Retrieved initial odometer reading from localStorage:", initialReading);
        }
      } catch (e) {
        console.warn("[SellerBookingsController] Could not get initial odometer from localStorage:", e);
      }
    }
    
    // Set a default if we still don't have a valid number
    if (isNaN(initialReading)) {
      console.warn("[SellerBookingsController] Setting default initial reading to 0 as current value is NaN");
      initialReading = 0;
    }
    
    console.log("[SellerBookingsController] Using initial odometer reading:", initialReading);
    
    // Use inline template for end trip modal
    const modalInstance = $uibModal.open({
      controller: function($scope, $uibModalInstance, initialReading, bookingData) {
        const modalVm = this;
        modalVm.initialReading = initialReading;
        modalVm.finalOdometer = initialReading > 0 ? initialReading + 100 : 100; // Default to a reasonable value
        modalVm.extraCharges = 0;
        
        // Calculate booking duration
        const startDate = new Date(bookingData.booking_start_date);
        const endDate = new Date(bookingData.booking_end_date);
        const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // Calculate allowed kilometers (100km per day)
        modalVm.durationDays = durationDays;
        modalVm.allowedKilometers = durationDays * 100;
        modalVm.kmRate = 10; // ₹10 per excess km
        
        // Update excess kilometers when final odometer changes
        modalVm.updateKmCharges = function() {
          const totalKm = modalVm.finalOdometer - initialReading;
          if (totalKm < 0) {
            modalVm.excessKilometers = 0;
            modalVm.kmCharges = 0;
            return;
          }
          
          modalVm.totalKm = totalKm;
          
          if (totalKm > modalVm.allowedKilometers) {
            modalVm.excessKilometers = totalKm - modalVm.allowedKilometers;
            modalVm.kmCharges = modalVm.excessKilometers * modalVm.kmRate;
          } else {
            modalVm.excessKilometers = 0;
            modalVm.kmCharges = 0;
          }
          
          // Calculate total extra charges
          modalVm.totalExtraCharges = modalVm.kmCharges + parseFloat(modalVm.extraCharges || 0);
        };
        
        // Initial calculation
        modalVm.updateKmCharges();
        
        modalVm.submitEndTrip = function() {
          if (!modalVm.finalOdometer) {
            $scope.error = "Please enter the final odometer reading";
            return;
          }
          
          const finalReadingValue = parseFloat(modalVm.finalOdometer);
          if (isNaN(finalReadingValue)) {
            $scope.error = "Please enter a valid number for the final reading";
            return;
          }
          
          if (finalReadingValue < initialReading) {
            $scope.error = "Final reading cannot be less than initial reading";
            return;
          }
          
          $uibModalInstance.close({
            finalReading: finalReadingValue,
            extraCharges: parseFloat(modalVm.extraCharges || 0)
          });
        };
      },
      controllerAs: 'modal',
      size: 'md',
      resolve: {
        initialReading: function() {
          return initialReading;
        },
        bookingData: function() {
          return booking;
        }
      },
      template: `
        <div class="modal-header">
          <button type="button" class="close" ng-click="$dismiss()">&times;</button>
          <h4 class="modal-title"><i class="glyphicon glyphicon-flag"></i> End Trip</h4>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" ng-if="error">{{error}}</div>
          
          <div class="form-group">
            <label>Initial Odometer Reading</label>
            <div class="input-group">
              <input type="number" class="form-control" disabled ng-model="modal.initialReading">
              <span class="input-group-addon">km</span>
            </div>
            <small class="text-muted">The odometer reading when the trip started</small>
          </div>
          
          <div class="form-group">
            <label>Final Odometer Reading</label>
            <div class="input-group">
              <input type="number" class="form-control" ng-model="modal.finalOdometer" 
                    ng-change="modal.updateKmCharges()"
                    placeholder="Final Odometer" min="{{modal.initialReading}}" required>
              <span class="input-group-addon">km</span>
            </div>
          </div>
          
          <div class="alert alert-info">
            <p><strong>Trip Duration:</strong> {{modal.durationDays}} days</p>
            <p><strong>Allowed Kilometers:</strong> {{modal.allowedKilometers}} km (100 km per day)</p>
            <p ng-if="modal.excessKilometers > 0"><strong>Excess Kilometers:</strong> {{modal.excessKilometers}} km</p>
            <p ng-if="modal.kmCharges > 0"><strong>Kilometer Charges:</strong> ₹{{modal.kmCharges}} (₹{{modal.kmRate}} per excess km)</p>
          </div>
          
          <div class="form-group">
            <label>Extra Charges (if any)</label>
            <div class="input-group">
              <span class="input-group-addon">₹</span>
              <input type="number" class="form-control" ng-model="modal.extraCharges" 
                    ng-change="modal.updateKmCharges()"
                    placeholder="Extra Charges" min="0" step="0.01">
            </div>
            <small class="text-muted">Additional charges beyond kilometer charges</small>
          </div>
          
          <div class="panel panel-default" ng-if="modal.totalExtraCharges > 0">
            <div class="panel-heading">
              <strong>Total Extra Charges: ₹{{modal.totalExtraCharges}}</strong>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" ng-click="$dismiss()">Cancel</button>
          <button class="btn btn-primary" ng-click="modal.submitEndTrip()">
            <i class="glyphicon glyphicon-stop"></i> End Trip
          </button>
        </div>
      `
    });
    
    modalInstance.result.then(function(formData) {
      vm.loading = true;
      bookingOperationInProgress = true;
      
      console.log("[SellerBookingsController] Ending trip with data:", formData);
      
      // Calculate total kilometers driven
      const totalKm = formData.finalReading - initialReading;
      console.log("[SellerBookingsController] Total KM calculated:", totalKm);
      
      // Make the API call to complete the trip
      BookingService.completeTrip(booking.booking_id, formData.finalReading, formData.extraCharges)
        .then(function(updatedBookingData) {
          console.log("[SellerBookingsController] Trip ended successfully:", updatedBookingData);
          
          // Create a booking instance from the response
          const updatedBooking = BookingFactory.createBooking(updatedBookingData);
          console.log("[SellerBookingsController] Created booking object after trip end:", updatedBooking);
          
          // Show confirmation message
          alert(`Trip completed successfully! Distance traveled: ${totalKm} km`);
          
          // Open receipt modal to show trip summary
          viewReceipt(updatedBooking);
          
          // Refresh the bookings list
                  return loadBookings();
        })
        .catch(function(error) {
          console.error("[SellerBookingsController] Error ending trip:", error);
          vm.error = typeof error === 'string' ? error : "Failed to end trip. Please try again.";
              })
              .finally(function() {
          vm.loading = false;
                bookingOperationInProgress = false;
              });
    });
  }

  /**
   * View a receipt for a completed booking
   * @param {Object} booking - The booking to view receipt for
   */
  function viewReceipt(booking) {
    if (!booking) {
      vm.error = "Invalid booking selected";
      return;
    }
    
    console.log("[SellerBookingsController] Viewing receipt for booking:", booking);
    console.log("[SellerBookingsController] Raw booking data:", JSON.stringify(booking));
    
    // For debugging purposes - make a direct API call to get the latest booking data
    const user = AuthService.getLoggedInUser();
    const bookingId = booking.booking_id || booking._id;
    
    // First attempt to get the latest booking data from the API
    BookingService.getBookingById(bookingId)
      .then(function(latestBookingData) {
        console.log("[SellerBookingsController] Retrieved latest booking data from API:", latestBookingData);
        displayReceipt(latestBookingData);
      })
      .catch(function(error) {
        console.warn("[SellerBookingsController] Error retrieving latest booking data, using provided booking:", error);
        displayReceipt(booking);
      });
    
    function displayReceipt(bookingData) {
      // Try multiple sources to get the initial and final odometer readings
      let initialReading = 0;
      let finalReading = 0;
      
      // Check different properties where the odometer readings might be stored
      
      // 1. Look for initial_odometer_reading in the booking
      if (typeof bookingData.initial_odometer_reading === 'number') {
        initialReading = bookingData.initial_odometer_reading;
        console.log("[SellerBookingsController] Found numeric initial reading:", initialReading);
      } else if (bookingData.initial_odometer_reading !== undefined && bookingData.initial_odometer_reading !== null) {
        initialReading = parseFloat(bookingData.initial_odometer_reading);
        console.log("[SellerBookingsController] Parsed string initial reading:", initialReading);
      } else {
        // Try to get from localStorage if not in the booking object
        try {
          const storedReading = localStorage.getItem(`booking_${bookingData.booking_id || bookingData._id}_initial_odometer`);
          if (storedReading) {
            initialReading = parseFloat(storedReading);
            console.log("[SellerBookingsController] Retrieved initial reading from localStorage:", initialReading);
          }
        } catch (e) {
          console.warn("[SellerBookingsController] Could not get initial odometer from localStorage:", e);
        }
      }
      
      // 2. Look for final_odometer_reading in the booking
      if (typeof bookingData.final_odometer_reading === 'number') {
        finalReading = bookingData.final_odometer_reading;
        console.log("[SellerBookingsController] Found numeric final reading:", finalReading);
      } else if (bookingData.final_odometer_reading !== undefined && bookingData.final_odometer_reading !== null) {
        finalReading = parseFloat(bookingData.final_odometer_reading);
        console.log("[SellerBookingsController] Parsed string final reading:", finalReading);
      }
      
      // Ensure we have valid numbers
      if (isNaN(initialReading)) {
        console.warn("[SellerBookingsController] Initial reading is NaN, defaulting to 0");
        initialReading = 0;
      }
      if (isNaN(finalReading)) {
        console.warn("[SellerBookingsController] Final reading is NaN, defaulting to 0");
        finalReading = 0;
      }
      
      // Create a backup copy of the readings
      // This is important - update the booking object to ensure correct readings are displayed
      if (bookingData.initial_odometer_reading === null || bookingData.initial_odometer_reading === undefined) {
        bookingData.initial_odometer_reading = initialReading;
        console.log("[SellerBookingsController] Updated booking with initial reading:", initialReading);
      }
      
      if (bookingData.final_odometer_reading === null || bookingData.final_odometer_reading === undefined) {
        bookingData.final_odometer_reading = finalReading;
        console.log("[SellerBookingsController] Updated booking with final reading:", finalReading);
      }
      
      // 3. Use the total_km from the booking object if available, otherwise calculate it
      let kmDriven = 0;
      if (typeof bookingData.total_km === 'number') {
        kmDriven = bookingData.total_km;
        console.log("[SellerBookingsController] Using total_km from booking:", kmDriven);
      } else if (bookingData.total_km !== undefined && bookingData.total_km !== null) {
        kmDriven = parseFloat(bookingData.total_km);
        console.log("[SellerBookingsController] Parsed total_km from booking:", kmDriven);
      } else {
        // Calculate it if not provided
        kmDriven = finalReading - initialReading;
        console.log("[SellerBookingsController] Calculated km driven:", kmDriven);
      }
      
      // Ensure kmDriven is not negative
      if (isNaN(kmDriven) || kmDriven < 0) {
        console.warn("[SellerBookingsController] KM driven invalid or negative, defaulting to 0");
        kmDriven = 0;
      }
      
      // Get pricing information
      const basePrice = typeof bookingData.total_price === 'number' ? 
        bookingData.total_price : parseFloat(bookingData.total_price || 0);
        
      // Calculate the booking duration in days
      const startDateObj = new Date(bookingData.booking_start_date);
      const endDateObj = new Date(bookingData.booking_end_date);
      const durationDays = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
      
      // Calculate the base price based on duration
      const basePricePerDay = basePrice;
      const basePriceTotal = basePricePerDay * durationDays;
      
      // Calculate allowed kilometers based on duration (100 km per day)
      const allowedKilometers = durationDays * 100;
      
      // Calculate excess kilometers
      let excessKilometers = 0;
      if (kmDriven > allowedKilometers) {
        excessKilometers = kmDriven - allowedKilometers;
      }
      
      // Calculate kilometer charges (10 rs per excess km)
      const kmChargeRate = 10; // Rs per km
      const kmCharges = excessKilometers * kmChargeRate;
      
      // Get manual extra charges from the booking
      const manualExtraCharges = typeof bookingData.extra_charges === 'number' ? 
        bookingData.extra_charges : parseFloat(bookingData.extra_charges || 0);
      
      // Calculate the total amount
      const totalExtraCharges = kmCharges + manualExtraCharges;
      const totalAmount = basePriceTotal + totalExtraCharges;
      
      console.log("[SellerBookingsController] Receipt values calculated:", {
        initialReading,
        finalReading,
        kmDriven,
        durationDays,
        basePricePerDay,
        basePriceTotal,
        allowedKilometers,
        excessKilometers,
        kmCharges,
        manualExtraCharges,
        totalExtraCharges,
        totalAmount
      });
      
      // Format dates
      const startDate = new Date(bookingData.booking_start_date).toLocaleDateString();
      const endDate = new Date(bookingData.booking_end_date).toLocaleDateString();
      
      // Format values for display
      const receiptDetails = {
        bookingId: bookingData._id || bookingData.booking_id,
        vehicle: bookingData.vehicle_details?.title || "Vehicle",
        startDate: startDate,
        endDate: endDate,
        initialReading: initialReading.toFixed(1) + " km",
        finalReading: finalReading.toFixed(1) + " km",
        kmDriven: kmDriven.toFixed(1) + " km",
        tripDuration: durationDays + " days",
        allowedKilometers: allowedKilometers + " km",
        excessKilometers: excessKilometers > 0 ? excessKilometers.toFixed(1) + " km" : "0 km",
        basePricePerDay: "₹" + basePricePerDay.toFixed(2) + "/day",
        basePriceTotal: "₹" + basePriceTotal.toFixed(2),
        kmCharges: kmCharges > 0 ? "₹" + kmCharges.toFixed(2) + " (₹" + kmChargeRate + "/km × " + excessKilometers.toFixed(1) + " km)" : "₹0.00",
        extraCharges: manualExtraCharges > 0 ? "₹" + manualExtraCharges.toFixed(2) : "₹0.00",
        totalExtraCharges: totalExtraCharges > 0 ? "₹" + totalExtraCharges.toFixed(2) : "₹0.00",
        totalAmount: "₹" + totalAmount.toFixed(2)
      };
      
      console.log("[SellerBookingsController] Formatted receipt details:", receiptDetails);
      
      // Open receipt modal with inline template
      const modalInstance = $uibModal.open({
        controller: function($uibModalInstance, receiptDetails) {
          const modalVm = this;
          modalVm.receipt = receiptDetails;
          console.log("[Receipt Modal] Receipt details received:", modalVm.receipt);
          
          modalVm.printReceipt = function() {
            window.print();
          };
          
          modalVm.downloadPdf = function() {
            $uibModalInstance.close('download');
          };
        },
        controllerAs: 'modal',
        size: 'md',
        resolve: {
          receiptDetails: function() {
            return receiptDetails;
          }
        },
        template: `
          <div class="modal-header">
            <button type="button" class="close" ng-click="$dismiss()">&times;</button>
            <h4 class="modal-title"><i class="glyphicon glyphicon-list-alt"></i> Trip Receipt</h4>
          </div>
          <div class="modal-body">
            <div id="printableReceipt" class="panel panel-default">
              <div class="panel-heading text-center">
                <h4>TRIP SUMMARY</h4>
              </div>
              <div class="panel-body">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Booking ID:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.bookingId}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Vehicle:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.vehicle}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Trip Duration:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.tripDuration}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Initial Odometer:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    <strong>{{modal.receipt.initialReading}}</strong>
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Final Odometer:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    <strong>{{modal.receipt.finalReading}}</strong>
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Distance Driven:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.kmDriven}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Allowed Kilometers:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.allowedKilometers}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Excess Kilometers:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.excessKilometers}}
                  </div>
                </div>
                
                <!-- Price Breakdown Section -->
                <hr>
                <h5 class="text-center"><strong>PRICE BREAKDOWN</strong></h5>
                <hr class="small">
                
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Base Price:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.basePricePerDay}}
                  </div>
                </div>
                <hr class="small">
                <div class="row">
                  <div class="col-xs-6">
                    <strong>Total Base Price:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    {{modal.receipt.basePriceTotal}}
                  </div>
                </div>
                
                <!-- Additional Charges Section (if any) -->
                <div ng-if="modal.receipt.kmCharges !== '₹0.00' || modal.receipt.extraCharges !== '₹0.00'">
                  <hr class="small">
                  <div class="row" ng-if="modal.receipt.kmCharges !== '₹0.00'">
                    <div class="col-xs-6">
                      <strong>Excess Kilometer Charges:</strong>
                    </div>
                    <div class="col-xs-6 text-right">
                      {{modal.receipt.kmCharges}}
                    </div>
                  </div>
                  <hr class="small" ng-if="modal.receipt.extraCharges !== '₹0.00'">
                  <div class="row" ng-if="modal.receipt.extraCharges !== '₹0.00'">
                    <div class="col-xs-6">
                      <strong>Extra Charges:</strong>
                    </div>
                    <div class="col-xs-6 text-right">
                      {{modal.receipt.extraCharges}}
                    </div>
                  </div>
                  <hr class="small">
                  <div class="row">
                    <div class="col-xs-6">
                      <strong>Total Additional Charges:</strong>
                    </div>
                    <div class="col-xs-6 text-right">
                      {{modal.receipt.totalExtraCharges}}
                    </div>
                  </div>
                </div>
                
                <!-- Final Total -->
                <hr>
                <div class="row">
                  <div class="col-xs-6">
                    <strong>TOTAL AMOUNT:</strong>
                  </div>
                  <div class="col-xs-6 text-right">
                    <strong>{{modal.receipt.totalAmount}}</strong>
                  </div>
                </div>
              </div>
              <div class="panel-footer text-center text-muted">
                <small>Thank you for using our service!</small>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" ng-click="$dismiss()">Close</button>
            <button class="btn btn-primary" ng-click="modal.printReceipt()">
              <i class="glyphicon glyphicon-print"></i> Print
            </button>
          </div>
        `
      });
      
      modalInstance.result.then(function(action) {
        if (action === 'download') {
          downloadReceipt(receiptDetails);
        }
      });
    }
  }

  /**
   * Download a receipt as PDF
   * @param {Object} receiptDetails - The receipt details to include in the PDF
   */
  function downloadReceipt(receiptDetails) {
    // Implementation depends on your PDF generation library
    // If you have a PDF generation service, you would call it here
    
    // Example using a hypothetical PDFService
    /*
    PDFService.generateReceipt(receiptDetails)
      .then(function(pdfBlob) {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(pdfBlob);
        link.download = `receipt_${receiptDetails.bookingId}.pdf`;
    link.click();
      })
      .catch(function(error) {
        console.error('Error generating PDF:', error);
        vm.error = 'Failed to generate receipt PDF. Please try again.';
      });
    */
    
    // For now, just show an alert
    alert('PDF download functionality will be implemented in the future.');
  }

  /**
   * Update booking status (generic method)
   * @param {string} bookingId - ID of the booking to update
   * @param {string} newStatus - New status to set
   * @param {number} kmValue - Odometer reading (for trip start/end)
   * @param {number} overcharge - Extra charges (for trip end)
   * @param {boolean} isStartTrip - Whether this is a trip start operation
   * @param {number} totalAmount - Total trip amount (for completed trips)
   */
  function updateBookingStatus(
    bookingId,
    newStatus,
    kmValue,
    overcharge,
    isStartTrip,
    totalAmount
  ) {
    if (bookingOperationInProgress) {
      return $q.reject("Operation in progress");
    }
    
    bookingOperationInProgress = true;
    vm.loading = true;
    vm.error = null;
    
    console.log("[SellerBookingsController] Updating booking status:", {
      bookingId, 
      newStatus, 
      kmValue, 
      overcharge, 
      isStartTrip, 
      totalAmount
    });
    
    // First validate the inputs using BookingFactory
    if (kmValue !== undefined && kmValue !== null) {
      // Convert to float to ensure we have a number
      kmValue = parseFloat(kmValue);
      
      if (isNaN(kmValue)) {
        vm.error = "Invalid odometer reading value";
        vm.loading = false;
        bookingOperationInProgress = false;
        return $q.reject(vm.error);
      }
      
      const kmErrors = BookingFactory.validateOdometerReading(kmValue);
      if (kmErrors.length > 0) {
        vm.error = kmErrors.join('. ');
        vm.loading = false;
        bookingOperationInProgress = false;
        return $q.reject(vm.error);
      }
    }
    
    if (overcharge !== undefined && overcharge !== null) {
      // Convert to float
      overcharge = parseFloat(overcharge);
      
      if (isNaN(overcharge)) {
        vm.error = "Invalid extra charges value";
        vm.loading = false;
        bookingOperationInProgress = false;
        return $q.reject(vm.error);
      }
      
      const overchargeErrors = BookingFactory.validateExtraCharges(overcharge);
      if (overchargeErrors.length > 0) {
        vm.error = overchargeErrors.join('. ');
        vm.loading = false;
        bookingOperationInProgress = false;
        return $q.reject(vm.error);
      }
    }
    
    // Prepare additional data based on operation type
    let additionalData = {};
    
    if (isStartTrip) {
      additionalData = {
        initial_odometer_reading: kmValue,
        trip_start_time: new Date().toISOString()
      };
      
      // Store in localStorage as a backup
      try {
        localStorage.setItem(`booking_${bookingId}_initial_odometer`, kmValue.toString());
      } catch (e) {
        console.warn("[SellerBookingsController] Could not save initial odometer to localStorage:", e);
      }
      
      console.log("[SellerBookingsController] Start trip data:", additionalData);
    } else if (newStatus === 'completed') {
      // For completed trips, retrieve the initial_odometer_reading
      let initialReading = 0;
      
      // Try to get it from localStorage
      try {
        const storedReading = localStorage.getItem(`booking_${bookingId}_initial_odometer`);
        if (storedReading) {
          initialReading = parseFloat(storedReading);
          console.log("[SellerBookingsController] Retrieved initial reading from localStorage:", initialReading);
        }
      } catch (e) {
        console.warn("[SellerBookingsController] Could not get initial odometer from localStorage:", e);
      }
      
      // Calculate total kilometers
      const totalKm = kmValue - initialReading;
      
      additionalData = {
        initial_odometer_reading: initialReading, // Include this to ensure it's in the DB
        final_odometer_reading: kmValue,
        total_km: totalKm > 0 ? totalKm : 0,
        extra_charges: overcharge || 0,
        trip_end_time: new Date().toISOString()
      };
      
      console.log("[SellerBookingsController] Complete trip data:", additionalData);
    }
    
    // Call the appropriate service method based on the operation
    let promise;
    
    if (isStartTrip) {
      promise = BookingService.startTrip(bookingId, kmValue);
    } else if (newStatus === 'completed') {
      promise = BookingService.completeTrip(bookingId, kmValue, overcharge);
    } else {
      promise = BookingService.updateBookingStatus(bookingId, newStatus, additionalData);
    }
    
    return promise
      .then(function(updatedBookingData) {
        console.log("[SellerBookingsController] Booking updated successfully:", updatedBookingData);
        
        // Create a booking instance from the response
        const updatedBooking = BookingFactory.createBooking(updatedBookingData);
        console.log("[SellerBookingsController] Created booking object after update:", updatedBooking);
        
        // If it's a completed trip with a total amount, show receipt
        if (newStatus === 'completed') {
          viewReceipt(updatedBooking);
        }
        
        // Refresh the bookings list
      return loadBookings();
    })
    .catch(function(error) {
        console.error("[SellerBookingsController] Error updating booking status:", error);
        vm.error = typeof error === 'string' ? error : "Failed to update booking status. Please try again.";
        return $q.reject(error);
      })
      .finally(function() {
        vm.loading = false;
        bookingOperationInProgress = false;
    });
  }
}
