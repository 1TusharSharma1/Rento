"use strict";

angular
  .module("carRentalApp")
  .controller("SellerBookingsController", SellerBookingsController);

SellerBookingsController.$inject = [
  "$scope",
  "SellerDashboardService",
  "AuthService",
  "DbService",
  "$state",
  "$q",
  "$uibModal"
];

function SellerBookingsController(
  $scope,
  SellerDashboardService,
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
  vm.currentView = "confirmed"; // default view: "Not Started" bookings
  vm.pagination = {
    rowsPerPage: 15,
    currentPage: 1,
    totalPages: 1,
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

  // Initialize automatically when controller is instantiated
  // Use ng-init="vm.init()" in the view template for proper initialization

  /////////////////////////
  // Initialization
  /////////////////////////

  /**
   * Initialize the controller
   * Verifies user permissions and loads initial data
   */
  function init() {
    console.log("Init function called");

    vm.userProfile = AuthService.getLoggedInUser();
    console.log("User Profile:", vm.userProfile);

    if (!vm.userProfile || !vm.userProfile.user_role.includes("seller")) {
      console.error("Invalid user or not a seller");
      $state.go("login");
      return;
    }

    // Load analytics and bookings once DB is ready
    vm.loading = true;
    $q.all([loadAnalytics(), loadBookings()]).finally(() => {
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

    // Count vehicles for this seller using the index
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
        vm.analytics.totalVehicles = vehicleCount;
      })
      .catch(function (err) {
        console.error("Error loading vehicle analytics:", err);
        deferred.reject(err);
      });

    // Compute booking analytics by fetching all bookings and filtering by seller
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

            bookings.forEach(function (booking) {
              if (
                booking.seller &&
                String(booking.seller.user_id) === sellerId
              ) {
                total++;
                const startDate = new Date(booking.booking_start_date);
                const endDate = new Date(booking.booking_end_date);
                if (startDate > today) {
                  upcoming++;
                } else if (endDate < today) {
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

  /////////////////////////
  // Load Bookings
  /////////////////////////

  /**
   * Load bookings for the current seller
   * Filters by seller ID and current view (status)
   * @returns {Promise} Promise resolving when bookings are loaded
   */
  function loadBookings() {
    const seller = AuthService.getLoggedInUser();
    const sellerId = String(seller.user_id);
    const deferred = $q.defer();

    DbService.getStore("bookings", "readonly")
      .then(function (store) {
        return $q(function (resolve, reject) {
          const req = store.getAll();
          req.onsuccess = function (event) {
            const allBookings = event.target.result || [];
            // Filter bookings for this seller and current view (status)
            const filtered = allBookings.filter(function (booking) {
              return (
                booking.seller &&
                String(booking.seller.user_id) === sellerId &&
                booking.status.trim().toLowerCase() === vm.currentView
              );
            });
            // Sort bookings by booking_date descending
            filtered.sort(function (a, b) {
              return new Date(b.booking_date) - new Date(a.booking_date);
            });
            resolve(filtered);
          };
          req.onerror = function (event) {
            reject(event.target.error);
          };
        });
      })
      .then(function (bookings) {
        vm.bookings = bookings;
        vm.pagination.currentPage = 1;
        vm.pagination.totalPages = Math.ceil(
          bookings.length / vm.pagination.rowsPerPage
        );
        deferred.resolve();
      })
      .catch(function (err) {
        console.error("Error loading seller bookings:", err);
        deferred.reject(err);
      });

    return deferred.promise;
  }

  /////////////////////////
  // Change View & Pagination
  /////////////////////////

  /**
   * Changes the current view/filter to display different booking statuses
   * @param {string} view - The booking status to display ('confirmed', 'in progress', 'completed', etc.)
   */
  function changeView(view) {
    vm.currentView = view;
    loadBookings();
  }

  /**
   * Returns paginated bookings for the current page
   * @returns {Array} Slice of bookings for the current page
   */
  function renderPage() {
    const startIndex =
      (vm.pagination.currentPage - 1) * vm.pagination.rowsPerPage;
    return vm.bookings.slice(
      startIndex,
      startIndex + vm.pagination.rowsPerPage
    );
  }

  /**
   * Navigates to the specified page in the pagination
   * @param {number} page - The page number to navigate to
   */
  function goToPage(page) {
    if (page >= 1 && page <= vm.pagination.totalPages) {
      vm.pagination.currentPage = page;
    }
  }

  /////////////////////////
  // Modal Functions: Start Trip, End Trip, and Receipt
  /////////////////////////
  function startTrip(booking) {
    $uibModal.open({
      templateUrl: 'startTripModal.html',
      controller: function($scope, $uibModalInstance) {
        $scope.modalVm = {
          bookingId: booking.booking_id,
          bookingStart: booking.booking_start_date,
          bookingEnd: booking.booking_end_date,
          initialOdometer: null,
          submitStartTrip: function() {
            const initialOdometer = parseFloat($scope.modalVm.initialOdometer);
            if (isNaN(initialOdometer) || initialOdometer < 0) {
              alert("Please enter a valid initial odometer reading.");
              return;
            }
            updateBookingStatus(booking.booking_id, "in progress", initialOdometer, 0, true)
              .then(function() {
                $uibModalInstance.close();
                return $q.all([loadAnalytics(), loadBookings()]);
              })
              .catch(function(err) {
                console.error("Error starting trip:", err);
              });
          }
        };
      }
    });
  }

  function endTrip(booking) {
    $uibModal.open({
      templateUrl: 'endTripModal.html',
      controller: function($scope, $uibModalInstance) {
        $scope.modalVm = {
          bookingId: booking.booking_id,
          bookingStart: booking.booking_start_date,
          bookingEnd: booking.booking_end_date,
          finalOdometer: null,
          submitEndTrip: function() {
            const finalOdometer = parseFloat($scope.modalVm.finalOdometer);
            if (isNaN(finalOdometer) || finalOdometer < 0) {
              alert("Please enter a valid final odometer reading.");
              return;
            }
            
            // Get booking record to compute details
            DbService.getRecord("bookings", booking.booking_id)
              .then(function(bookingRecord) {
                const initialOdometer = bookingRecord.initial_odometer;
                const kmDriven = finalOdometer - initialOdometer;
                if (kmDriven < 0) {
                  alert("Final odometer must be greater than or equal to the initial reading.");
                  throw new Error("Invalid odometer readings.");
                }
                
                const startDate = new Date(bookingRecord.booking_start_date);
                const endDate = new Date(bookingRecord.booking_end_date);
                const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                const daysToCharge = days <= 0 ? 1 : days;
                const averageKmPerDay = kmDriven / daysToCharge;

                // Calculate overcharge for exceeding 100km/day limit
                let overcharge = 0;
                if (averageKmPerDay > 100) {
                  const extraKms = kmDriven - 100 * daysToCharge;
                  overcharge = extraKms * 10;
                }
                const finalPrice = bookingRecord.booking_amount * daysToCharge + overcharge;

                return updateBookingStatus(
                  booking.booking_id,
                  "completed",
                  kmDriven,
                  overcharge,
                  false,
                  finalPrice
                ).then(function() {
                  $uibModalInstance.close();
                  
                  // Open receipt modal after trip is ended
                  viewReceiptWithDetails({
                    duration: daysToCharge + " day(s)",
                    kmDriven: kmDriven.toFixed(2) + " km",
                    basePrice: "Rs " + bookingRecord.booking_amount,
                    extraCharge: "Rs " + overcharge.toFixed(2),
                    finalPrice: "Rs " + finalPrice.toFixed(2)
                  });
                });
              })
              .catch(function(err) {
                console.error("Error ending trip:", err);
              });
          }
        };
      }
    });
  }

  function viewReceipt(booking) {
    DbService.getRecord("bookings", booking.booking_id)
      .then(function(bookingRecord) {
        if (!bookingRecord) {
          alert("Booking not found.");
          return;
        }
        
        const startDate = new Date(bookingRecord.booking_start_date);
        const endDate = new Date(bookingRecord.booking_end_date);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const daysToCharge = days <= 0 ? 1 : days;
        const kmDriven = bookingRecord.total_km || 0;
        const overcharge = bookingRecord.overcharge || 0;
        const basePrice = bookingRecord.booking_amount;
        const finalPrice = basePrice * daysToCharge + overcharge;

        viewReceiptWithDetails({
          duration: daysToCharge + " day(s)",
          kmDriven: kmDriven.toFixed(2) + " km",
          basePrice: "Rs " + basePrice,
          extraCharge: "Rs " + overcharge.toFixed(2),
          finalPrice: "Rs " + finalPrice.toFixed(2)
        });
      })
      .catch(function(err) {
        console.error("Error retrieving booking for receipt:", err);
      });
  }

  // Helper function to open receipt modal with provided details
  function viewReceiptWithDetails(details) {
    $uibModal.open({
      templateUrl: 'receiptModal.html',
      controller: function($scope, $uibModalInstance) {
        $scope.modalVm = {
          details: details,
          downloadReceipt: function() {
            const receiptText =
              "Trip Receipt\n\n" +
              "Duration: " + details.duration + "\n" +
              "Total KM Driven: " + details.kmDriven + "\n" +
              "Base Price per Day: " + details.basePrice + "\n" +
              "Extra Charges: " + details.extraCharge + "\n" +
              "Final Price: " + details.finalPrice + "\n\n" +
              "Thank you for using RentO!";
            
            const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "TripReceipt.txt";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        };
      }
    });
  }

  /**
   * Creates and downloads a text receipt
   * Generates a text file with booking details
   */
  function downloadReceipt() {
    const details = vm.modal.receipt.details;
    const receiptText =
      "Trip Receipt\n\n" +
      "Duration: " +
      details.duration +
      "\n" +
      "Total KM Driven: " +
      details.kmDriven +
      "\n" +
      "Base Price per Day: " +
      details.basePrice +
      "\n" +
      "Extra Charges: " +
      details.extraCharge +
      "\n" +
      "Final Price: " +
      details.finalPrice +
      "\n\n" +
      "Thank you for using RentO!";
    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "TripReceipt.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper: Update booking status and related values
  function updateBookingStatus(
    bookingId,
    newStatus,
    kmValue,
    overcharge,
    isStartTrip,
    totalAmount
  ) {
    return DbService.getRecord("bookings", bookingId).then(function (booking) {
      if (!booking) {
        return $q.reject("Booking not found");
      }
      booking.status = newStatus;
      if (isStartTrip) {
        booking.initial_odometer = kmValue;
      } else {
        booking.total_km = kmValue;
        booking.overcharge = overcharge;
        if (totalAmount !== undefined && totalAmount !== null) {
          booking.total_amount = totalAmount;
        }
      }
      return DbService.updateRecord("bookings", booking);
    });
  }
}
