'use strict';

angular
  .module('carRentalApp')
  .controller('AdminAnalyticsController', AdminAnalyticsController);

AdminAnalyticsController.$inject = ['$q', '$timeout', 'DbService', 'AuthService', 'AnalyticsService'];

function AdminAnalyticsController($q, $timeout, DbService, AuthService, AnalyticsService) {
  var vm = this;
  vm.adminId = null;
  vm.analyticsData = {}; // Object to hold computed metrics
  vm.init = init;
  vm.loadAnalytics = loadAnalytics;
  vm.isCollapsed = true;
  vm.activeState = 'adminAnalytics';
  vm.logout = logout;

  function init() {
    var admin = AuthService.getLoggedInUser();
    if (!admin || !admin.user_id || admin.user_role.indexOf('admin') === -1) {
      alert("You must be logged in as an admin.");
      window.location.href = "/validations/login.html";
      return;
    }
    vm.adminId = admin.user_id;
    loadAnalytics();
  }

  function logout() {
    AuthService.logout();
    window.location.href = "/validations/login.html";
  }

  function loadAnalytics() {
    return $q.all({
      vehicles: DbService.getAllRecords('vehicles'),
      bookings: DbService.getAllRecords('bookings'),
      bids: DbService.getAllRecords('bidding'),
      conversations: DbService.getAllRecords('conversations'),
      users: DbService.getAllRecords('users')
    })
    .then(function(results) {
      const vehicles = results.vehicles || [];
      const bookings = results.bookings || [];
      const bids = results.bids || [];
      const conversations = results.conversations || [];
      const users = results.users || [];

      // Basic metrics
      vm.analyticsData = {
        totalUsers: users.length,
        totalVehicles: vehicles.length,
        totalBookings: bookings.length,
        totalBids: bids.length,
        totalConversations: conversations.length,
        userStats: {
          sellers: users.filter(u => Array.isArray(u.user_role) ? u.user_role.includes('seller') : u.user_role === 'seller').length,
          buyers: users.filter(u => Array.isArray(u.user_role) ? u.user_role.includes('buyer') : u.user_role === 'buyer').length
        },

        // Computed metrics
        listingToFirstBooking: calculateListingToFirstBooking(vehicles, bookings),
        avgBookingDuration: calculateAvgBookingDuration(bookings),
        bidRejectionRate: calculateBidRejectionRate(bids),
        mostQueried: calculateMostQueried(vehicles, conversations),
        totalRevenue: calculateTotalRevenue(bookings),
        avgBookingValue: calculateAvgBookingValue(bookings),
        mostPopular: calculateMostPopularVehicle(vehicles, bookings),
        
        // New metrics
        bookingCompletionRate: calculateBookingCompletionRate(bookings),
        avgRevenuePerVehicle: calculateAvgRevenuePerVehicle(vehicles, bookings),
        userRetention: calculateUserRetention(bookings, users),
        
        // Outstation vs Local metrics
        outstationRevenue: calculateOutstationRevenue(bookings),
        localRevenue: calculateLocalRevenue(bookings)
      };

      vm.topUsers = calculateTopUsers(users, bookings);
      vm.seasonalTrends = calculateSeasonalTrends(bookings);

      // Clear any existing charts first
      if (window.Chart && Chart.helpers) {
        Chart.helpers.each(Chart.instances || [], function(instance) {
          instance.destroy();
        });
      }

      $timeout(function() {
        // Draw charts only if their canvas elements exist
        if (document.getElementById('vehiclesOverTimeChart')) {
          drawVehiclesOverTimeChart(vehicles);
        }
        if (document.getElementById('userGrowthChart')) {
          drawUserGrowthChart(users);
        }
        if (document.getElementById('bidVsRentalChart')) {
          drawBidVsRentalChart(vehicles, bids);
        }
        if (document.getElementById('topBookedCarsChart')) {
          drawTopBookedCarsChart(vehicles, bookings);
        }
        if (document.getElementById('convosVsBookingsChart')) {
          drawConvosVsBookingsChart(vehicles, conversations, bookings);
        }
        if (document.getElementById('conversionRateChart')) {
          drawConversionRateChart(bids, bookings);
        }
        if (document.getElementById('activeLocationChart')) {
          drawLocationChart(vehicles);
        }
        if (document.getElementById('priceCompetitivenessChart')) {
          drawPriceCompetitivenessChart(vehicles);
        }
        if (document.getElementById('outstationLocalChart')) {
          drawOutstationVsLocalChart(bookings);
        }
        if (document.getElementById('avgBookingDurationByTypeChart')) {
          drawAvgBookingDurationByTypeChart(bookings);
        }
        if (document.getElementById('avgBidAmountByTypeChart')) {
          drawAvgBidAmountByTypeChart(bids);
        }
        if (document.getElementById('mostBiddedChart')) {
          drawMostBiddedChart(bids, vehicles);
        }
        if (document.getElementById('seasonalTrendsChart')) {
          drawSeasonalTrendsChart(bookings);
        }
        if (document.getElementById('userRetentionChart')) {
          drawUserRetentionChart(bookings, users);
        }
      }, 100);
    })
    .catch(function(error) {
      console.error("Error loading analytics data:", error);
    });
  }

  // Computes average time (in days) between vehicle upload and its first booking
  function calculateListingToFirstBooking(vehicles, bookings) {
    if (!vehicles || !bookings || !vehicles.length || !bookings.length) return 'N/A';
    
    let totalDiff = 0;
    let count = 0;
    
    vehicles.forEach(vehicle => {
      if (!vehicle.uploaded_at) return;
      
      const vehicleBookings = bookings.filter(b => b.vehicle_id === vehicle.vehicle_id);
      if (vehicleBookings.length === 0) return;
      
      const firstBooking = vehicleBookings.reduce((earliest, booking) => {
        return !earliest || new Date(booking.booking_date) < new Date(earliest.booking_date) 
          ? booking 
          : earliest;
      }, null);
      
      if (firstBooking) {
        const diff = (new Date(firstBooking.booking_date) - new Date(vehicle.uploaded_at)) / (1000 * 60 * 60 * 24);
        if (!isNaN(diff)) {
          totalDiff += diff;
          count++;
        }
      }
    });
    
    return count > 0 ? (totalDiff / count).toFixed(1) : 'N/A';
  }

  // Computes average booking duration in days
  function calculateAvgBookingDuration(bookings) {
    if (!bookings || !bookings.length) return 'N/A';
    
    let total = 0;
    let count = 0;
    
    bookings.forEach(booking => {
      if (booking.booking_start_date && booking.booking_end_date) {
        const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
        if (!isNaN(duration)) {
          total += duration;
          count++;
        }
      }
    });
    
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  }

  // Computes average time (in days) from bid date to booking start date
  function calculateAvgBidToBookingTime(bids, bookings) {
    var total = 0, count = 0;
    bookings.forEach(function(b) {
      var relatedBid = bids.find(function(bid) { 
        return bid.bid_id === b.bid_id; 
      });
      if (relatedBid && b.booking_start_date && relatedBid.bid_date) {
        var diff = (new Date(b.booking_start_date) - new Date(relatedBid.bid_date)) / (1000 * 60 * 60 * 24);
        total += diff;
        count++;
      }
    });
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  }

  // Computes average bid acceptance time in hours
  function calculateBidAcceptTime(bids, bookings) {
    var total = 0, count = 0;
    bookings.forEach(function(b) {
      var relatedBid = bids.find(function(bid) { 
        return bid.bid_id === b.bid_id; 
      });
      if (relatedBid && b.booking_date && relatedBid.bid_date) {
        var diffHours = (new Date(b.booking_date) - new Date(relatedBid.bid_date)) / (1000 * 60 * 60);
        total += diffHours;
        count++;
      }
    });
    return count > 0 ? (total / count).toFixed(1) : 'N/A';
  }

  // Computes bid rejection rate as a percentage
  function calculateBidRejectionRate(bids) {
    if (!bids || !bids.length) return 'N/A';
    const rejected = bids.filter(b => b.bid_status === "Rejected").length;
    return ((rejected / bids.length) * 100).toFixed(1);
  }

  // Determines the most queried vehicle based on conversation count
  function calculateMostQueried(vehicles, conversations) {
    if (!vehicles || !conversations || !vehicles.length || !conversations.length) return 'N/A';
    
    const queryCount = {};
    conversations.forEach(c => {
      if (c.vehicle_id) {
        queryCount[c.vehicle_id] = (queryCount[c.vehicle_id] || 0) + 1;
      }
    });
    
    let maxCount = 0;
    let mostQueriedId = null;
    
    for (const [vehicleId, count] of Object.entries(queryCount)) {
      if (count > maxCount) {
        maxCount = count;
        mostQueriedId = vehicleId;
      }
    }
    
    const vehicle = vehicles.find(v => v.vehicle_id === mostQueriedId);
    return vehicle ? `${vehicle.vehicle_model} (${maxCount} queries)` : 'N/A';
  }

  // Computes total revenue from all bookings
  function calculateTotalRevenue(bookings) {
    if (!bookings || !bookings.length) return '0.00';
    const total = bookings.reduce((sum, booking) => {
      if (booking.booking_start_date && booking.booking_end_date && booking.booking_amount) {
        const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
        return sum + (duration * Number(booking.booking_amount));
      }
      return sum;
    }, 0);
    return total.toFixed(2);
  }

  // Calculates outstation revenue
  function calculateOutstationRevenue(bookings) {
    if (!bookings || !bookings.length) return '0.00';
    
    const total = bookings
      .filter(b => b.isOutstation)
      .reduce((sum, booking) => {
        if (booking.booking_start_date && booking.booking_end_date && booking.booking_amount) {
          const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
          return sum + (duration * Number(booking.booking_amount));
        }
        return sum;
      }, 0);
      
    return total.toFixed(2);
  }

  // Calculates local revenue
  function calculateLocalRevenue(bookings) {
    if (!bookings || !bookings.length) return '0.00';
    
    const total = bookings
      .filter(b => !b.isOutstation)
      .reduce((sum, booking) => {
        if (booking.booking_start_date && booking.booking_end_date && booking.booking_amount) {
          const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
          return sum + (duration * Number(booking.booking_amount));
        }
        return sum;
      }, 0);
      
    return total.toFixed(2);
  }

  // Computes the most popular vehicle
  function calculateMostPopularVehicle(vehicles, bookings) {
    if (!vehicles || !bookings || !vehicles.length || !bookings.length) return 'N/A';
    
    const bookingCounts = {};
    bookings.forEach(booking => {
      if (booking.vehicle && booking.vehicle.vehicle_id) {
        const vehicleId = booking.vehicle.vehicle_id;
        bookingCounts[vehicleId] = (bookingCounts[vehicleId] || 0) + 1;
      } else if (booking.vehicle_id) {
        bookingCounts[booking.vehicle_id] = (bookingCounts[booking.vehicle_id] || 0) + 1;
      }
    });
    
    let maxCount = 0;
    let popularVehicleId = null;
    
    for (const [vehicleId, count] of Object.entries(bookingCounts)) {
      if (count > maxCount) {
        maxCount = count;
        popularVehicleId = vehicleId;
      }
    }
    
    const vehicle = vehicles.find(v => v.vehicle_id === popularVehicleId);
    if (!vehicle) return 'N/A';
    
    return `${vehicle.vehicle_model} (${maxCount} bookings)`;
  }

  // Add these functions to your AdminAnalyticsController

function drawOutstationVsLocalChart(bookings) {
  if (!bookings || !bookings.length) return;
  
  // Calculate outstation vs local stats
  const outstationBookings = bookings.filter(b => b.is_outstation);
  const localBookings = bookings.filter(b => !b.is_outstation);
  
  const ctx = document.getElementById('outstationLocalChart').getContext('2d');
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Outstation', 'Local'],
      datasets: [{
        data: [outstationBookings.length, localBookings.length],
        backgroundColor: ['#3498db', '#2ecc71']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = bookings.length;
              const percentage = Math.round((value / total) * 100);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function drawAvgBookingDurationByTypeChart(bookings) {
  if (!bookings || !bookings.length) return;
  
  // Calculate average duration for outstation and local bookings
  let outstationDurations = [];
  let localDurations = [];
  
  bookings.forEach(function(booking) {
    if (!booking.booking_start_date || !booking.booking_end_date) return;
    
    const startDate = new Date(booking.booking_start_date);
    const endDate = new Date(booking.booking_end_date);
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (booking.is_outstation) {
      outstationDurations.push(duration);
    } else {
      localDurations.push(duration);
    }
  });
  
  const outstationAvg = outstationDurations.length ? 
    outstationDurations.reduce((a, b) => a + b, 0) / outstationDurations.length : 0;
  
  const localAvg = localDurations.length ? 
    localDurations.reduce((a, b) => a + b, 0) / localDurations.length : 0;
  
  const ctx = document.getElementById('avgBookingDurationByTypeChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Local', 'Outstation'],
      datasets: [{
        label: 'Average Booking Duration (days)',
        data: [localAvg.toFixed(1), outstationAvg.toFixed(1)],
        backgroundColor: ['#3498db', '#9b59b6']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Days'
          }
        }
      }
    }
  });
}

function drawAvgBidAmountByTypeChart(bids) {
  if (!bids || !bids.length) return;
  
  // Calculate average bid amount for outstation and local bids
  let outstationBids = [];
  let localBids = [];
  
  bids.forEach(function(bid) {
    if (!bid.bid_amount) return;
    
    const amount = parseFloat(bid.bid_amount);
    if (isNaN(amount)) return;
    
    if (bid.is_outstation) {
      outstationBids.push(amount);
    } else {
      localBids.push(amount);
    }
  });
  
  const outstationAvg = outstationBids.length ? 
    outstationBids.reduce((a, b) => a + b, 0) / outstationBids.length : 0;
  
  const localAvg = localBids.length ? 
    localBids.reduce((a, b) => a + b, 0) / localBids.length : 0;
  
  const ctx = document.getElementById('avgBidAmountByTypeChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Local', 'Outstation'],
      datasets: [{
        label: 'Average Bid Amount (₹)',
        data: [localAvg.toFixed(0), outstationAvg.toFixed(0)],
        backgroundColor: ['#2ecc71', '#e74c3c']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount (₹)'
          },
          ticks: {
            callback: function(value) {
              return '₹' + value;
            }
          }
        }
      }
    }
  });
}

function drawMostBiddedChart(bids, vehicles) {
  if (!bids || !bids.length || !vehicles || !vehicles.length) return;
  
  // Count bids per vehicle
  const bidCounts = {};
  bids.forEach(function(bid) {
    if (!bid.vehicle_id) return;
    bidCounts[bid.vehicle_id] = (bidCounts[bid.vehicle_id] || 0) + 1;
  });
  
  // Convert to array and sort
  const vehicleBids = Object.keys(bidCounts).map(function(vehicleId) {
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
    return {
      vehicleId: vehicleId,
      vehicleName: vehicle ? `${vehicle.vehicle_make} ${vehicle.vehicle_model}` : 'Unknown Vehicle',
      bidCount: bidCounts[vehicleId]
    };
  }).sort((a, b) => b.bidCount - a.bidCount).slice(0, 5);
  
  const ctx = document.getElementById('mostBiddedChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: vehicleBids.map(v => v.vehicleName),
      datasets: [{
        label: 'Number of Bids',
        data: vehicleBids.map(v => v.bidCount),
        backgroundColor: '#f39c12'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Bids'
          }
        }
      }
    }
  });
}
  // -------------------- Chart Rendering Functions -------------------- //

  function drawVehiclesOverTimeChart(vehicles) {
    if (!vehicles || !vehicles.length) return;
        const vehiclesByMonth = vehicles.reduce((acc, vehicle) => {
      const date = new Date(vehicle.created_at);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      acc[monthYear] = (acc[monthYear] || 0) + 1;
      return acc;
    }, {});

    const ctx = document.getElementById("vehiclesOverTimeChart");
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(vehiclesByMonth),
        datasets: [{
          label: 'New Vehicles',
          data: Object.values(vehiclesByMonth),
          borderColor: '#3498db',
          fill: true,
          backgroundColor: 'rgba(52, 152, 219, 0.1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Vehicle Growth Over Time' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  function drawUserGrowthChart(users) {
    if (!users || !users.length) return;
    
    const usersByMonth = users.reduce((acc, user) => {
      const date = new Date(user.created_at);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      acc[monthYear] = (acc[monthYear] || 0) + 1;
      return acc;
    }, {});

    const ctx = document.getElementById("userGrowthChart");
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(usersByMonth),
        datasets: [{
          label: 'New Users',
          data: Object.values(usersByMonth),
          borderColor: '#2ecc71',
          fill: true,
          backgroundColor: 'rgba(46, 204, 113, 0.1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'User Growth Trend' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  function drawLocationChart(vehicles) {
    if (!vehicles || !vehicles.length) return;
    
    const locationCounts = vehicles.reduce((acc, vehicle) => {
      const location = vehicle.location || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    const ctx = document.getElementById("activeLocationChart");
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(locationCounts),
        datasets: [{
          data: Object.values(locationCounts),
          backgroundColor: [
            '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', 
            '#9b59b6', '#34495e', '#1abc9c', '#e67e22'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Vehicle Distribution by Location' },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  function drawPriceCompetitivenessChart(vehicles) {
    if (!vehicles || !vehicles.length) return;
    
    const priceRanges = {
      'Budget': { min: 0, max: 1000, count: 0 },
      'Mid-Range': { min: 1001, max: 3000, count: 0 },
      'Premium': { min: 3001, max: 5000, count: 0 },
      'Luxury': { min: 5001, max: Infinity, count: 0 }
    };

    vehicles.forEach(vehicle => {
      const price = vehicle.pricing?.basePrice || 0;
      for (const [range, data] of Object.entries(priceRanges)) {
        if (price >= data.min && price <= data.max) {
          data.count++;
          break;
        }
      }
    });

    const ctx = document.getElementById("priceCompetitivenessChart");
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(priceRanges),
        datasets: [{
          label: 'Number of Vehicles',
          data: Object.values(priceRanges).map(r => r.count),
          backgroundColor: '#3498db'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Vehicle Price Range Distribution' }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  function drawBidVsRentalChart(vehicles, bids) {
    if (!vehicles || !bids || !vehicles.length || !bids.length) {
      console.log('No data available for Bid vs Rental chart');
      return;
    }

    // Get vehicles with bids and their pricing info
    const vehiclesWithBids = vehicles.filter(v => {
      const hasBids = bids.some(b => 
        b.vehicle && b.vehicle.vehicle_id === v.vehicle_id
      );
      const hasPrice = v.pricing && (v.pricing.basePrice || v.pricing.basePriceOutstation);
      return hasBids && hasPrice;
    });

    // Sort by number of bids and take top 5
    const topVehicles = vehiclesWithBids
      .map(v => ({
        vehicle: v,
        bidCount: bids.filter(b => b.vehicle && b.vehicle.vehicle_id === v.vehicle_id).length
      }))
      .sort((a, b) => b.bidCount - a.bidCount)
      .slice(0, 5)
      .map(item => item.vehicle);

    const labels = topVehicles.map(v => v.vehicleModel || 'Unknown Vehicle');
    
    // Get rental prices from pricing object
    const rentalPrices = topVehicles.map(v => 
      Number(v.pricing && v.pricing.basePrice) || 0
    );

    // Calculate average bid amounts
    const avgBids = topVehicles.map(v => {
      const vehicleBids = bids.filter(b => 
        b.vehicle && b.vehicle.vehicle_id === v.vehicle_id
      );
      
      if (!vehicleBids.length) return 0;
      
      const validBids = vehicleBids
        .map(b => Number(b.bid_amount))
        .filter(amount => !isNaN(amount) && amount > 0);
      
      return validBids.length ? 
        validBids.reduce((sum, amount) => sum + amount, 0) / validBids.length : 
        0;
    });

    const ctx = document.getElementById("bidVsRentalChart");
    if (!ctx) {
      console.error('Could not find bidVsRentalChart canvas element');
      return;
    }

    new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Base Rental Price",
            data: rentalPrices,
            backgroundColor: "#e74c3c",
            borderColor: "#c0392b",
            borderWidth: 1
          },
          {
            label: "Average Bid Amount",
            data: avgBids,
            backgroundColor: "#2ecc71",
            borderColor: "#27ae60",
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Top 5 Most Bid Vehicles - Price Comparison'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `₹${context.raw.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount (₹)'
            },
            ticks: {
              callback: function(value) {
                return '₹' + value;
              }
            }
          }
        }
      }
    });
  }

  function drawTopBookedCarsChart(vehicles, bookings) {
    if (!vehicles || !bookings || !vehicles.length || !bookings.length) {
      console.log('No data available for Top Booked Cars chart');
      return;
    }

    // Count bookings per vehicle and store vehicle info
    const vehicleStats = {};
    bookings.forEach(booking => {
      if (booking.vehicle && booking.vehicle.vehicle_id && booking.status === "Confirmed") {
        const vehicleId = booking.vehicle.vehicle_id;
        if (!vehicleStats[vehicleId]) {
          vehicleStats[vehicleId] = {
            name: booking.vehicle.name || 'Unknown Vehicle',
            count: 0,
            revenue: 0
          };
        }
        vehicleStats[vehicleId].count++;
        vehicleStats[vehicleId].revenue += Number(booking.booking_amount) || 0;
      }
    });

    // Convert to array and sort by booking count
    const topVehicles = Object.entries(vehicleStats)
      .map(([id, stats]) => ({
        name: stats.name,
        count: stats.count,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // If no data available
    if (!topVehicles.length) {
      console.log('No booking data available for vehicles');
      return;
    }

    const ctx = document.getElementById("topBookedCarsChart");
    if (!ctx) {
      console.error('Could not find topBookedCarsChart canvas element');
      return;
    }

    new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: topVehicles.map(v => v.name),
        datasets: [
          {
            label: "Number of Bookings",
            data: topVehicles.map(v => v.count),
            backgroundColor: "#3498db",
            borderColor: "#2980b9",
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: "Total Revenue (₹)",
            data: topVehicles.map(v => v.revenue),
            backgroundColor: "#2ecc71",
            borderColor: "#27ae60",
            borderWidth: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Top 5 Most Booked Vehicles'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 0) {
                  return `Bookings: ${context.raw}`;
                }
                return `Revenue: ₹${context.raw.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'Number of Bookings'
            },
            ticks: {
              stepSize: 1
            }
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            title: {
              display: true,
              text: 'Revenue (₹)'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  function drawConvosVsBookingsChart(vehicles, conversations, bookings) {
    if (!vehicles || !conversations || !bookings) return;
    
    const activeVehicleIds = vehicles.map(v => v.vehicle_id);
    const validConversations = conversations.filter(c => 
      activeVehicleIds.includes(c.vehicle_id) && c.status !== 'deleted'
    );
    const validBookings = bookings.filter(b => 
      activeVehicleIds.includes(b.vehicle_id) && b.status !== 'cancelled'
    );

    const ctx = document.getElementById("convosVsBookingsChart").getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Active Conversations", "Confirmed Bookings"],
        datasets: [{
          data: [validConversations.length, validBookings.length],
          backgroundColor: ["#8e44ad", "#3498db"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: {
            display: true,
            text: 'Conversations to Bookings Ratio'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = validConversations.length + validBookings.length;
                const percentage = ((context.raw / total) * 100).toFixed(1);
                return `${context.label}: ${context.raw} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  function drawConversionRateChart(bids, bookings) {
    if (bids.length === 0) return;
    var conversionRate = bookings.length ? (bookings.length / bids.length) * 100 : 0;
    var canvas = document.getElementById("conversionRateChart");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Converted", "Not Converted"],
        datasets: [{ data: [bookings.length, bids.length - bookings.length], backgroundColor: ["#2ecc71", "#e74c3c"] }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: "Conversion Rate: " + conversionRate.toFixed(1) + "%" }
        }
      }
    });
  }

  function calculateTopUsers(users, bookings) {
    const userStats = {};
    
    bookings.forEach(booking => {
      const userId = booking.renter_id;
      if (!userStats[userId]) {
        const user = users.find(u => u.user_id === userId);
        userStats[userId] = {
          name: user ? `${user.first_name} ${user.last_name}` : 'Unknown User',
          totalBookings: 0,
          totalValue: 0
        };
      }
      userStats[userId].totalBookings++;
      userStats[userId].totalValue += Number(booking.booking_amount) || 0;
    });

    return Object.values(userStats)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  }

  // Calculate booking completion rate (what percentage of bookings are completed vs cancelled)
  function calculateBookingCompletionRate(bookings) {
    if (!bookings || !bookings.length) return 'N/A';
    
    const completed = bookings.filter(b => b.status === 'completed').length;
    return ((completed / bookings.length) * 100).toFixed(1) + '%';
  }

  // Calculate average revenue per vehicle
  function calculateAvgRevenuePerVehicle(vehicles, bookings) {
    if (!vehicles || !bookings || !vehicles.length) return '0.00';
    
    const vehicleRevenue = {};
    
    bookings.forEach(booking => {
      if (!booking.vehicle_id && (!booking.vehicle || !booking.vehicle.vehicle_id)) return;
      
      const vehicleId = booking.vehicle_id || booking.vehicle.vehicle_id;
      const amount = Number(booking.booking_amount) || 0;
      
      if (booking.booking_start_date && booking.booking_end_date) {
        const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
        const totalAmount = duration * amount;
        
        vehicleRevenue[vehicleId] = (vehicleRevenue[vehicleId] || 0) + totalAmount;
      }
    });
    
    const vehiclesWithBookings = Object.keys(vehicleRevenue).length;
    if (vehiclesWithBookings === 0) return '0.00';
    
    const totalRevenue = Object.values(vehicleRevenue).reduce((sum, rev) => sum + rev, 0);
    return (totalRevenue / vehiclesWithBookings).toFixed(2);
  }

  // Calculate user retention rate
  function calculateUserRetention(bookings, users) {
    if (!bookings || !users || !bookings.length || !users.length) return 'N/A';
    
    // Get users who have made multiple bookings
    const userBookingCounts = {};
    bookings.forEach(booking => {
      if (!booking.renter_id && (!booking.renter || !booking.renter.user_id)) return;
      
      const userId = booking.renter_id || booking.renter.user_id;
      userBookingCounts[userId] = (userBookingCounts[userId] || 0) + 1;
    });
    
    const repeatUsers = Object.values(userBookingCounts).filter(count => count > 1).length;
    const totalUsersWithBookings = Object.keys(userBookingCounts).length;
    
    if (totalUsersWithBookings === 0) return '0%';
    return ((repeatUsers / totalUsersWithBookings) * 100).toFixed(1) + '%';
  }

  // Calculate top users by booking count
  function calculateTopUsers(users, bookings) {
    if (!users || !bookings || !users.length || !bookings.length) return [];
    
    const userBookingCounts = {};
    
    bookings.forEach(booking => {
      if (!booking.renter_id && (!booking.renter || !booking.renter.user_id)) return;
      
      const userId = booking.renter_id || booking.renter.user_id;
      userBookingCounts[userId] = (userBookingCounts[userId] || 0) + 1;
    });
    
    return Object.entries(userBookingCounts)
      .map(([userId, count]) => {
        const user = users.find(u => u.user_id === userId);
        return {
          userId: userId,
          name: user ? (user.name || user.username || 'Unknown User') : 'Unknown User',
          bookingCount: count
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);
  }

  // Calculate seasonal booking trends
  function calculateSeasonalTrends(bookings) {
    if (!bookings || !bookings.length) return null;
    
    const monthlyBookings = Array(12).fill(0);
    const monthlyRevenue = Array(12).fill(0);
    
    bookings.forEach(booking => {
      if (!booking.booking_date) return;
      
      const date = new Date(booking.booking_date);
      const month = date.getMonth();
      const amount = Number(booking.booking_amount) || 0;
      
      monthlyBookings[month]++;
      monthlyRevenue[month] += amount;
    });
    
    return {
      bookings: monthlyBookings,
      revenue: monthlyRevenue
    };
  }

  // Draw seasonal trends chart
  function drawSeasonalTrendsChart(bookings) {
    const trends = calculateSeasonalTrends(bookings);
    if (!trends) return;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const ctx = document.getElementById('seasonalTrendsChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Bookings',
            data: trends.bookings,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            yAxisID: 'y'
          },
          {
            label: 'Revenue (₹)',
            data: trends.revenue,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'Number of Bookings'
            }
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            title: {
              display: true,
              text: 'Revenue (₹)'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  // Draw user retention chart
  function drawUserRetentionChart(bookings, users) {
    if (!bookings || !users || !bookings.length || !users.length) return;
    
    // Count bookings per user
    const userBookingCounts = {};
    bookings.forEach(booking => {
      if (!booking.renter_id && (!booking.renter || !booking.renter.user_id)) return;
      
      const userId = booking.renter_id || booking.renter.user_id;
      userBookingCounts[userId] = (userBookingCounts[userId] || 0) + 1;
    });
    
    // Group users by booking count
    const bookingCountDistribution = {
      '1 booking': 0,
      '2-3 bookings': 0,
      '4-5 bookings': 0,
      '6+ bookings': 0
    };
    
    Object.values(userBookingCounts).forEach(count => {
      if (count === 1) {
        bookingCountDistribution['1 booking']++;
      } else if (count >= 2 && count <= 3) {
        bookingCountDistribution['2-3 bookings']++;
      } else if (count >= 4 && count <= 5) {
        bookingCountDistribution['4-5 bookings']++;
      } else {
        bookingCountDistribution['6+ bookings']++;
      }
    });
    
    const ctx = document.getElementById('userRetentionChart').getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(bookingCountDistribution),
        datasets: [{
          data: Object.values(bookingCountDistribution),
          backgroundColor: ['#e74c3c', '#f39c12', '#2ecc71', '#3498db']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'User Retention - Booking Frequency'
          },
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = Object.values(bookingCountDistribution).reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} users (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Calculate average booking value
  function calculateAvgBookingValue(bookings) {
    if (!bookings || !bookings.length) return '0.00';
    
    const validBookings = bookings.filter(booking => 
      booking.booking_amount && !isNaN(Number(booking.booking_amount))
    );
    
    if (!validBookings.length) return '0.00';
    
    const total = validBookings.reduce((sum, booking) => {
      if (booking.booking_start_date && booking.booking_end_date) {
        const duration = (new Date(booking.booking_end_date) - new Date(booking.booking_start_date)) / (1000 * 60 * 60 * 24) + 1;
        return sum + (duration * Number(booking.booking_amount));
      }
      return sum + Number(booking.booking_amount);
    }, 0);
    
    return (total / validBookings.length).toFixed(2);
  }
}
