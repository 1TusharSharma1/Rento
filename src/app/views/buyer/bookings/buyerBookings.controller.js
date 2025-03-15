'use strict';

angular.module('carRentalApp')
  .controller('BuyerBookingsController', BuyerBookingsController)
    
    
    BuyerBookingsController.$inject['$scope', 'DbService', 'AuthService']

    function BuyerBookingsController($scope, DbService, AuthService) {
    $scope.currentView = 'confirmed'; 
    $scope.analytics = {
      totalBookings: 0,
      upcomingBookings: 0, 
      completedBookings: 0
    };
    $scope.bookings = [];
    $scope.modal = null;


    function getLoggedInBuyer() {
      return AuthService.getLoggedInUser();
    }


    const buyer = getLoggedInBuyer();    

    $scope.init = function s() {
      $scope.loadBuyerAnalytics();
      $scope.loadBuyerBookings();
    }

    $scope.loadBuyerAnalytics = function() {
      DbService.getAllRecords('bookings').then(function(bookings) {
        let total = 0;
        let upcoming = 0;
        let completed = 0;
        const today = new Date();

        bookings.forEach(function(booking) {
          if (booking.renter && booking.renter.user_id === String(buyer.user_id)) {
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

        $scope.analytics.totalBookings = total;
        $scope.analytics.upcomingBookings = upcoming;
        $scope.analytics.completedBookings = completed;
      });
    };

    // Load bookings filtered by current view selection
    $scope.loadBuyerBookings = function() {
      DbService.getAllRecords('bookings').then(function(bookings) {
        $scope.bookings = bookings.filter(function(booking) {
          return booking.renter &&
                 booking.renter.user_id === String(buyer.user_id) &&
                 booking.status.trim().toLowerCase() === $scope.currentView;
        });
      });
    };

    // Change current view filter
    $scope.changeView = function(view) {
      $scope.currentView = view;
      $scope.loadBuyerBookings();
    };

    // Cancel a confirmed booking
    $scope.cancelBooking = function(booking) {
      if (confirm("Are you sure you want to cancel this booking?")) {
        booking.status = 'Cancelled';
        DbService.updateRecord('bookings', booking).then(function() {
          $scope.loadBuyerAnalytics();
          $scope.loadBuyerBookings();
        });
      }
    };

    // Show receipt details in modal
    $scope.showReceiptModal = function(booking) {
      const startDate = new Date(booking.booking_start_date);
      const endDate = new Date(booking.booking_end_date);
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const kmDriven = booking.total_km || 0;
      const overcharge = booking.overcharge || 0;
      const basePrice = booking.booking_amount;
      const finalPrice = (basePrice * days) + overcharge;

      $scope.modal = {
        type: 'receipt',
        booking: booking,
        receipt: {
          duration: `${days} day(s)`,
          kmDriven: `${kmDriven.toFixed(2)} km`,
          basePrice: `Rs ${basePrice}`,
          extraCharge: `Rs ${overcharge.toFixed(2)}`,
          finalPrice: `Rs ${finalPrice.toFixed(2)}`
        }
      };
    };

    // Close any open modal
    $scope.closeModal = function() {
      $scope.modal = null;
    };
  };
