'use strict';

angular
  .module('carRentalApp')
  .controller('SellerAnalyticsController', SellerAnalyticsController);

SellerAnalyticsController.$inject = ['$q', 'DbService', 'BiddingService', 'SellerDashboardService', 'AuthService', 'AnalyticsService', '$scope'];

function SellerAnalyticsController($q, DbService, BiddingService, SellerDashboardService, AuthService, AnalyticsService, $scope) {    
  const vm = this;
  
  // View model properties
  vm.sellerId = null;
  vm.sellerVehicles = [];
  vm.stats = {
    totalRevenue: 0,
    avgBookingDuration: 0,
    mostQueriedVehicle: 'N/A',
    mostBiddedVehicle: 'N/A',
    listingToFirstBooking: 0,
    outstationStats: {}
  };
  vm.init = init;
  

  vm.loadAnalytics = loadAnalytics;
  

  /**
   * Initializes the controller, checks authentication,
   * sets up the seller ID, and pre-loads seller vehicles
   */
  function init() {
    const seller = AuthService.getLoggedInUser();
    if (!seller || !seller.user_id) {
      alert("You must be logged in as a seller.");
      window.location.href = "/validations/login.html";
      return;
    }
    
    vm.sellerId = seller.user_id;
    AnalyticsService.getSellerVehicles(vm.sellerId)
      .then(function(vehicles) {
        vm.sellerVehicles = vehicles;
        return loadAnalytics();
      })
      .catch(function(err) {
        console.error("Error loading seller vehicles:", err);
      });
  }
  
  // ====================================
  // Analytics Loading
  // ====================================


  /**
   * Loads all analytics data for the seller
   * Fetches vehicles, bookings, bids, and conversations
   * Then computes aggregated statistics
   * @returns {Promise} Promise that resolves with stats object
   */
  function loadAnalytics() {
    return $q.all({
      vehicles: $q.when(vm.sellerVehicles),
      bookings: getSellerBookings(),
      bids: getSellerBids(),
      conversations: getSellerConversations()
    })
    .then(function(results) {
      const vehicles = results.vehicles || [];
      const bookings = results.bookings || [];
      const bids = results.bids || [];
      const conversations = results.conversations || [];
      
      vm.stats = AnalyticsService.computeStats(vehicles, bookings, bids, conversations);
      vm.stats.listingToFirstBooking = calculateListingToFirstBooking(vehicles, bookings);
      vm.stats.outstationStats = AnalyticsService.getOutstationStats(bookings);
      vm.stats.totalBookings = bookings.length;
      vm.stats.totalBids = bids.length;
      vm.stats.mostRentedVehicleData = calculateMostRentedVehicle(bookings);
      
      calculateBiddingAndBookingByType(bids, bookings);
      setTimeout(function() {
        AnalyticsService.renderCharts(vm.stats, vehicles);
      }, 100);
      
      return vm.stats;
    })
    .catch(function(err) {
      console.error("Error loading analytics:", err);
    });
  }
  
  // ====================================
  // Data Retrieval Methods
  // ====================================
  /**
   * Retrieves all bookings for the current seller
   * @returns {Promise} Promise that resolves with bookings array
   */
  function getSellerBookings() {
    return DbService.getIndex('bookings', 'seller_id', 'readonly')
      .then(function(index) {
        return $q(function(resolve, reject) {
          try {
            const request = index.getAll(vm.sellerId);
            
            request.onsuccess = function(event) {
              resolve(event.target.result || []);
            };
            
            request.onerror = function(event) {
              reject(event.target.error);
            };
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch(function(err) {
        console.error("Error getting seller bookings:", err);
        return [];
      });
  }
  
  /**
   * Retrieves all bids for the current seller
   * @returns {Promise} Promise that resolves with bids array
   */
  function getSellerBids() {
    return SellerDashboardService.loadBids()
      .catch(function(err) {
        console.error("Error getting seller bids:", err);
        return [];
      });
  }
  
  /**
   * Retrieves all conversations for the current seller
   * @returns {Promise} Promise that resolves with conversations array
   */
  function getSellerConversations() {
    return DbService.getIndex('conversations', 'receiver_id', 'readonly')
      .then(function(index) {
        return $q(function(resolve, reject) {
          try {
            const request = index.getAll(vm.sellerId);
            
            request.onsuccess = function(event) {
              resolve(event.target.result || []);
            };
            
            request.onerror = function(event) {
              reject(event.target.error);
            };
          } catch (err) {
            reject(err);
          }
        });
      })
      .catch(function(err) {
        console.error("Error getting seller conversations:", err);
        return [];
      });
  }
  
  // ====================================
  // Analytics Calculation Methods
  // ====================================
  /**
   * Calculates the average time from listing to first booking across all vehicles
   * @param {Array} vehicles - Array of vehicle objects
   * @param {Array} bookings - Array of booking objects
   * @returns {number} Average days from listing to first booking
   */
  function calculateListingToFirstBooking(vehicles, bookings) {
    const timeDiffs = [];
    
    vehicles.forEach(function(vehicle) {
      const vehicleBookings = bookings.filter(function(b) {
        return b.vehicle_id === vehicle.vehicle_id || 
              (b.vehicle && b.vehicle.vehicle_id === vehicle.vehicle_id);
      });
      
      if (vehicleBookings.length > 0 && vehicle.uploaded_at) {
        vehicleBookings.sort(function(a, b) {
          return new Date(a.booking_date) - new Date(b.booking_date);
        });
        
        const firstBookingDate = new Date(vehicleBookings[0].booking_date);
        const uploadDate = new Date(vehicle.uploaded_at);
        const diffDays = (firstBookingDate - uploadDate) / (1000 * 60 * 60 * 24);
        
        if (!isNaN(diffDays)) {
          timeDiffs.push(diffDays);
        }
      }
    });
    
    return timeDiffs.length > 0 ? 
      (timeDiffs.reduce(function(a, b) { return a + b; }, 0) / timeDiffs.length).toFixed(1) : 0;
  }
  
  /**
   * Calculates the most frequently rented vehicle
   * @param {Array} bookings - Array of booking objects
   * @returns {Object|null} Object containing most rented vehicle info or null
   */
  function calculateMostRentedVehicle(bookings) {
    const vehicleBookingCounts = {};
    const totalBookings = bookings.length;
    
    bookings.forEach(function(booking) {
      const vehicleId = booking.vehicle_id || (booking.vehicle && booking.vehicle.vehicle_id);
      if (vehicleId) {
        vehicleBookingCounts[vehicleId] = (vehicleBookingCounts[vehicleId] || 0) + 1;
      }
    });
    
    const sortedVehicles = Object.entries(vehicleBookingCounts).sort(function(a, b) {
      return b[1] - a[1];
    });
    
    return sortedVehicles.length > 0 ? {
      vehicleId: sortedVehicles[0][0],
      count: sortedVehicles[0][1],
      totalBookings: totalBookings
    } : null;
  }
  
  /**
   * Calculates bidding and booking statistics separated by type (outstation vs local)
   * @param {Array} bids - Array of bid objects
   * @param {Array} bookings - Array of booking objects
   */
  function calculateBiddingAndBookingByType(bids, bookings) {
    // Calculate outstation vs local bidding stats
    const outstationBids = [];
    const localBids = [];
    
    bids.forEach(function(bid) {
      if (bid.bid_amount) {
        if (parseBoolean(bid.isOutstation)) {
          outstationBids.push(Number(bid.bid_amount));
        } else {
          localBids.push(Number(bid.bid_amount));
        }
      }
    });
    
    const outstationAvgAmount = outstationBids.length > 0 ? 
      outstationBids.reduce(function(a, b) { return a + b; }, 0) / outstationBids.length : 0;
    
    const localAvgAmount = localBids.length > 0 ? 
      localBids.reduce(function(a, b) { return a + b; }, 0) / localBids.length : 0;
    
    vm.stats.bidAmountByType = {
      outstationAvgAmount: outstationAvgAmount.toFixed(2),
      localAvgAmount: localAvgAmount.toFixed(2)
    };
    
    // Booking duration stats by type are already in outstationStats
    vm.stats.bookingDurationByType = {
      outstationAvgDuration: vm.stats.outstationStats.outstationAvgDuration,
      localAvgDuration: vm.stats.outstationStats.localAvgDuration
    };
  }
  
  // ====================================
  // Utility Functions
  // ====================================
  /**
   * Parses a value to boolean
   * @param {*} val - Value to parse
   * @returns {boolean} Parsed boolean value
   */
  function parseBoolean(val) {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true";
    return false;
  }
}
