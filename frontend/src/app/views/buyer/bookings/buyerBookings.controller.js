'use strict';

angular.module('carRentalApp')
  .controller('BuyerBookingsController', BuyerBookingsController);
    
    
BuyerBookingsController.$inject = ['$scope', '$http', 'AuthService', 'BookingService', 'BookingFactory', '$state', 'AppConfig'];

function BuyerBookingsController($scope, $http, AuthService, BookingService, BookingFactory, $state, AppConfig) {
    const API_BASE = AppConfig.apiBaseUrl || 'http://localhost:5050';
    
    // View state
    $scope.currentView = 'pending'; 
    $scope.loading = false;
    $scope.error = null;
    
    // Data
    $scope.analytics = {
      totalBookings: 0,
      upcomingBookings: 0, 
      completedBookings: 0
    };
    $scope.bookings = [];
    $scope.modal = null;

    // Check if user is logged in
    function checkAuthentication() {
      const user = AuthService.getLoggedInUser();
      if (!user) {
        // Redirect to login if not logged in
        $state.go('login');
        return false;
      }
      return true;
    }

    $scope.init = function() {
      if (!checkAuthentication()) return;
      
      $scope.loadBookings();
    }

    // Load bookings and analytics
    $scope.loadBookings = function() {
      if (!checkAuthentication()) return;
      
      $scope.loading = true;
      $scope.error = null;
      
      // Use BookingService instead of direct HTTP call
      BookingService.getRenterBookings($scope.currentView)
        .then(function(response) {
          if (response && response.data) {
            // Create booking objects using the factory
            const bookingsData = response.data;
            const bookingObjects = BookingFactory.createBookingArray(bookingsData);
            $scope.bookings = bookingObjects; // This list is already filtered by status
            
            // Calculate analytics based *only* on the full set of bookings
            // We still need the full set for accurate totals
            return BookingService.getRenterBookings(); // Get all bookings for analytics
          }
          return null; // Return null if initial fetch failed
        })
        .then(function(allResponse) {
          if (allResponse && allResponse.data) {
            const allBookings = BookingFactory.createBookingArray(allResponse.data);
            const today = new Date();
            let upcoming = 0;
            let completed = 0;
            
            allBookings.forEach(function(booking) {
              // Use confirmed status and date for upcoming
              if (booking.isConfirmed() && new Date(booking.booking_start_date) >= today) {
                upcoming++;
              // Use completed status for completed
              } else if (booking.isCompleted()) {
                completed++;
              }
            });
            
            $scope.analytics = {
              totalBookings: allBookings.length,
              upcomingBookings: upcoming,
              completedBookings: completed
            };
          } else {
            // If fetching all bookings failed, reset analytics or use defaults
            $scope.analytics = { totalBookings: 0, upcomingBookings: 0, completedBookings: 0 };
          }
        })
        .catch(function(error) {
          console.error('Error loading bookings:', error);
          $scope.error = error || 'Failed to load bookings';
          // Reset analytics on error
          $scope.analytics = { totalBookings: 0, upcomingBookings: 0, completedBookings: 0 };
        })
        .finally(function() {
          $scope.loading = false;
        });
    };

    // Change current view filter
    $scope.changeView = function(view) {
      $scope.currentView = view;
      $scope.loadBookings();
    };

    // Cancel a confirmed booking
    $scope.cancelBooking = function(booking) {
      if (!checkAuthentication()) return;
      
      if (confirm("Are you sure you want to cancel this booking?")) {
        $scope.loading = true;
        
        // Validate the operation using BookingFactory
        if (!booking.isConfirmed() && !booking.isPending()) {
          $scope.error = "Only confirmed or pending bookings can be cancelled";
          $scope.loading = false;
          return;
        }
        
        // Use the booking service for the API call
        BookingService.cancelBooking(booking.booking_id, "Cancelled by user")
          .then(function(updatedBookingData) {
            // Create a booking object from the response
            const updatedBooking = BookingFactory.createBooking(updatedBookingData);
            
            // Update the local booking or reload all bookings
            const index = $scope.bookings.findIndex(b => b.booking_id === updatedBooking.booking_id);
            if (index !== -1) {
              $scope.bookings[index] = updatedBooking;
            } else {
              $scope.loadBookings();
            }
          })
          .catch(function(error) {
            console.error('Error cancelling booking:', error);
            $scope.error = error || 'Failed to cancel booking';
          })
          .finally(function() {
            $scope.loading = false;
          });
      }
    };

    // Show receipt details in modal
    $scope.showReceiptModal = function(booking) {
      // Use BookingFactory methods to calculate values
      const days = booking.getBookingDurationInDays();
      const kmDriven = booking.total_km || 0;
      const overcharge = booking.extra_charges || 0;
      const basePrice = booking.total_price || 0;
      
      $scope.modal = {
        type: 'receipt',
        booking: booking,
        receipt: {
          duration: `${days} day(s)`,
          kmDriven: `${kmDriven.toFixed(2)} km`,
          basePrice: booking.getFormattedTotalPrice(),
          extraCharge: booking.getFormattedExtraCharges(),
          finalPrice: booking.getFormattedFinalPrice()
        }
      };
    };

    // Close any open modal
    $scope.closeModal = function() {
      $scope.modal = null;
    };

    // Calculate booking duration using factory method
    $scope.getBookingDuration = function(booking) {
      if (!booking) return 'N/A';
      
      const days = booking.getBookingDurationInDays();
      return days === 1 ? '1 day' : days + ' days';
    };
}
