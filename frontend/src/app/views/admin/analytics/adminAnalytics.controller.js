'use strict';

angular
  .module('carRentalApp')
  .controller('AdminAnalyticsController', AdminAnalyticsController);

AdminAnalyticsController.$inject = ['$q', '$timeout', 'AuthService', 'AnalyticsService', 'ValidationService', '$rootScope', '$state'];

function AdminAnalyticsController($q, $timeout, AuthService, AnalyticsService, ValidationService, $rootScope, $state) {
  const vm = this;
  vm.analyticsData = {}; // Object to hold all analytics
  
  // Date filters
  vm.dateFilter = {
    startDate: new Date('2025-03-17'), // First user creation date
    endDate: new Date('2025-03-26'), // Last user creation date
    timeUnit: 'day'
  };
  
  // Methods
  vm.init = init;
  vm.loadAnalytics = loadAnalytics;
  vm.refreshData = refreshData;
  vm.isCollapsed = true;
  vm.activeState = 'adminAnalytics';
  vm.logout = logout;
  vm.error = null;

  // Chart configuration defaults
  const chartDefaults = {
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          stepSize: 1
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Users: ${context.raw}`;
          }
        }
      }
    }
  };

  function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  function formatChartDate(dateStr, timeUnit) {
    const date = new Date(dateStr);
    switch(timeUnit) {
      case 'day':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          timeZone: 'UTC'
        });
      case 'week':
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      case 'month':
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric',
          timeZone: 'UTC'
        });
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString();
    }
  }

  function renderLineChart(chartId, data, labels, label) {
    if (!document.getElementById(chartId)) return;
    
    const config = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                if (label === 'Revenue') {
                  return '₹' + value.toLocaleString('en-IN');
                }
                return value;
              },
              maxTicksLimit: 10
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.dataset.label === 'Revenue') {
                  label += '₹' + context.parsed.y.toLocaleString('en-IN');
                } else {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          }
        }
      }
    };
    
    new Chart(document.getElementById(chartId), config);
  }

  function renderBarChart(chartId, data, labels, label) {
    if (!document.getElementById(chartId)) return;
    
    const config = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        }]
      },
      options: chartDefaults
    };
    
    new Chart(document.getElementById(chartId), config);
  }

  function init() {
    loadAnalytics();
  }

  function logout() {
    AuthService.logout()
      .then(function() {
        $state.go('login');
      })
      .catch(function(error) {
        console.error("Logout error:", error);
        // Still redirect to login page even if there's an error
        $state.go('login');
      });
  }

  function refreshData() {
    // Validate dates before refreshing
    const validation = ValidationService.validateAnalyticsDates(vm.dateFilter);
    if (!validation.isValid) {
      vm.error = validation.error;
      return;
    }
    
    // Clear existing chart data and error
    vm.error = null;
    clearCharts();
    // Reload with new date filters
    loadAnalytics();
  }

  function loadAnalytics() {
    // Validate dates before loading
    const validation = ValidationService.validateAnalyticsDates(vm.dateFilter);
    if (!validation.isValid) {
      vm.error = validation.error;
      return $q.reject(new Error(validation.error));
    }
    
    // Show loading indicator
    vm.isLoading = true;
    vm.error = null; // Reset error state
    
    // Create params from date filters
    const params = {
      startDate: formatDate(vm.dateFilter.startDate),
      endDate: formatDate(vm.dateFilter.endDate),
      timeUnit: vm.dateFilter.timeUnit
    };
    
    // Load all analytics data concurrently
    return $q.all({
      dashboard: AnalyticsService.getDashboardStats().catch(handleError),
      users: AnalyticsService.getUserStats(params).catch(handleError),
      bookings: AnalyticsService.getBookingStats(params).catch(handleError),
      biddings: AnalyticsService.getBiddingStats({ limit: 10 }).catch(handleError),
      vehicles: AnalyticsService.getVehicleStats(params).catch(handleError)
    })
    .then(function(results) {
      vm.isLoading = false;
      
      // Check if we have any data to display
      if (Object.values(results).every(result => !result)) {
        vm.error = "Failed to load any analytics data. Please try again later.";
        return;
      }

      // Store results and render available charts
      vm.analyticsData = results;
      $timeout(renderCharts, 100);
    })
    .catch(function(error) {
      vm.isLoading = false;
      vm.error = error.message || "Error loading analytics data. Please try again later.";
      console.error("Error loading analytics data:", error);
    });
  }

  function handleError(error) {
    // Check if error is from backend validation
    if (error.data && error.data.message) {
      vm.error = error.data.message;
    }
    console.error("API error:", error);
    return null; // Return null instead of rejecting to allow other requests to complete
  }

  function clearCharts() {
    if (window.Chart && Chart.helpers) {
      Chart.helpers.each(Chart.instances || [], function(instance) {
        instance.destroy();
      });
    }
  }

  function renderCharts() {
    // User charts
    renderUserCharts();
    
    // Booking charts
    renderBookingCharts();
    
    // Bidding charts
    renderBiddingCharts();
    
    // Vehicle charts
    renderVehicleCharts();
  }

  function renderUserCharts() {
    const users = vm.analyticsData.users;
    
    if (!users) return;
    
    // User roles chart
    if (document.getElementById('userRolesChart') && users.usersByRole) {
      const data = users.usersByRole.map(r => r.count);
      const labels = users.usersByRole.map(r => r.role);
      
      new Chart(document.getElementById('userRolesChart'), {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
    
    // User growth chart
    if (document.getElementById('userGrowthChart') && users.userGrowth) {
      const data = users.userGrowth.map(item => item.count);
      const labels = users.userGrowth.map(item => formatChartDate(item.date, vm.dateFilter.timeUnit));
      
      renderLineChart('userGrowthChart', data, labels, 'New Users');
    }
    
    // User retention chart
    if (document.getElementById('userRetentionChart') && users.userRetention) {
      const data = [
        users.userRetention.usersWithOneBooking || 0,
        users.userRetention.usersWithMultipleBookings || 0
      ];
      const labels = ['One-time Users', 'Returning Users'];
      
      new Chart(document.getElementById('userRetentionChart'), {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }

  function renderBookingCharts() {
    const bookings = vm.analyticsData.bookings;
    
    if (!bookings) return;
    
    // Booking status chart
    if (document.getElementById('bookingStatusChart') && bookings.bookingsByStatus) {
      const data = bookings.bookingsByStatus.map(b => b.count);
      const labels = bookings.bookingsByStatus.map(b => b.status);
      
      new Chart(document.getElementById('bookingStatusChart'), {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(75, 192, 192, 0.2)'
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
    
    // Revenue over time chart
    if (document.getElementById('revenueOverTimeChart') && bookings.revenueOverTime) {
      const data = bookings.revenueOverTime.map(item => item.revenue);
      const labels = bookings.revenueOverTime.map(item => formatChartDate(item.date, vm.dateFilter.timeUnit));
      
      renderLineChart('revenueOverTimeChart', data, labels, 'Revenue');
    }
    
    // Outstation vs local chart
    if (document.getElementById('outstationLocalChart') && bookings.outstationVsLocal) {
      const data = bookings.outstationVsLocal.map(b => b.count);
      const labels = bookings.outstationVsLocal.map(b => b.is_outstation ? 'Outstation' : 'Local');
      
      AnalyticsService.renderDoughnutChart('outstationLocalChart', data, labels);
    }
    
    // Top vehicles chart
    if (document.getElementById('topVehiclesChart') && bookings.topVehicles) {
      const data = bookings.topVehicles.map(v => v.bookingCount);
      const labels = bookings.topVehicles.map(v => v.title);
      
      AnalyticsService.renderBarChart('topVehiclesChart', data, labels, 'Booking Count');
    }
  }
  
  function renderBiddingCharts() {
    const biddings = vm.analyticsData.biddings;
    
    if (!biddings) return;
    
    // Bid status chart
    if (document.getElementById('bidStatusChart') && biddings.bidsByStatus) {
      const data = biddings.bidsByStatus.map(b => b.count);
      const labels = biddings.bidsByStatus.map(b => b.status);
      
      AnalyticsService.renderPieChart('bidStatusChart', data, labels);
    }
    
    // Conversion rate chart
    if (document.getElementById('conversionRateChart') && biddings.conversionRate) {
      const data = [
        biddings.conversionRate.accepted || 0,
        biddings.conversionRate.converted || 0,
        biddings.conversionRate.rejected || 0,
        biddings.conversionRate.expired || 0
      ];
      const labels = ['Accepted', 'Converted', 'Rejected', 'Expired'];
      
      AnalyticsService.renderPieChart('conversionRateChart', data, labels);
    }
    
    // Bid time of day chart
    if (document.getElementById('bidTimeOfDayChart') && biddings.bidsByTimeOfDay) {
      const data = new Array(24).fill(0);
      biddings.bidsByTimeOfDay.forEach(item => {
        data[item.hour] = item.count;
      });
      
      const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
      
      AnalyticsService.renderBarChart('bidTimeOfDayChart', data, labels, 'Bids by Hour');
    }
    
    // Most bidded vehicles chart
    if (document.getElementById('mostBiddedChart') && biddings.mostBiddedVehicles) {
      const data = biddings.mostBiddedVehicles.map(v => v.bidCount);
      const labels = biddings.mostBiddedVehicles.map(v => v.title);
      
      AnalyticsService.renderBarChart('mostBiddedChart', data, labels, 'Bid Count');
    }
  }
  
  function renderVehicleCharts() {
    const vehicles = vm.analyticsData.vehicles;
    
    if (!vehicles) return;
    
    // Vehicle category chart
    if (document.getElementById('vehicleCategoryChart') && vehicles.vehiclesByCategory) {
      const data = vehicles.vehiclesByCategory.map(cat => cat.count);
      const labels = vehicles.vehiclesByCategory.map(cat => cat.category);
      
      AnalyticsService.renderPieChart('vehicleCategoryChart', data, labels);
    }
    
    // Vehicle location chart
    if (document.getElementById('vehicleLocationChart') && vehicles.vehiclesByLocation) {
      const data = vehicles.vehiclesByLocation.map(loc => loc.count);
      const labels = vehicles.vehiclesByLocation.map(loc => loc.location);
      
      AnalyticsService.renderBarChart('vehicleLocationChart', data, labels, 'Vehicles by Location');
    }
    
    // Price range chart
    if (document.getElementById('priceRangeChart') && vehicles.priceRangesByCategory) {
      const data = vehicles.priceRangesByCategory.map(cat => cat.avgPrice);
      const labels = vehicles.priceRangesByCategory.map(cat => cat.category);
      
      AnalyticsService.renderBarChart('priceRangeChart', data, labels, 'Avg. Price');
    }
    
    // Vehicle growth chart
    if (document.getElementById('vehicleGrowthChart') && vehicles.vehicleGrowth) {
      const data = vehicles.vehicleGrowth.map(item => item.newListings);
      const labels = vehicles.vehicleGrowth.map(item => formatChartDate(item.date, vm.dateFilter.timeUnit));
      
      renderLineChart('vehicleGrowthChart', data, labels, 'New Listings');
    }
  }
}

