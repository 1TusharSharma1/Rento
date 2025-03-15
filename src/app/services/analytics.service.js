'use strict';
  
  angular
    .module('carRentalApp')
    .service('AnalyticsService', AnalyticsService);
  
  AnalyticsService.$inject = ['$q', 'DbService'];
  
  function AnalyticsService($q, DbService) {
    const service = {
      // Core analytics methods
      getSellerVehicles: getSellerVehicles,
      computeStats: computeStats,
      renderCharts: renderCharts,
      calculateTotalRevenue: calculateTotalRevenue,
      calculateAvgBookingDuration: calculateAvgBookingDuration,
      findMostQueriedVehicle: findMostQueriedVehicle,
      findMostBiddedVehicle: findMostBiddedVehicle,
      renderPieChart: renderPieChart,
      renderBarChart: renderBarChart,
      renderDoughnutChart: renderDoughnutChart,
      renderMostBiddedChart: renderMostBiddedChart,
      renderConversionRateChart: renderConversionRateChart,
      renderLocationChart: renderLocationChart,
      renderPriceCompetitivenessChart: renderPriceCompetitivenessChart,
      renderBidVsRentalChart: renderBidVsRentalChart,
      renderMostRentedChart: renderMostRentedChart,
      getOutstationStats: getOutstationStats,
      renderOutstationVsLocalChart: renderOutstationVsLocalChart,
      renderAvgBookingDurationByTypeChart: renderAvgBookingDurationByTypeChart,
      renderAvgBidAmountByTypeChart: renderAvgBidAmountByTypeChart,
      getTotalUsers: getTotalUsers,
      getTotalVehicles: getTotalVehicles,
      getTotalBookings: getTotalBookings,
      getTotalBids: getTotalBids,
      getTotalMessages: getTotalMessages,
      getTotalRevenue: getTotalRevenue
    };
    
    return service;

    /**
     * Retrieves all vehicles belonging to a specific seller
     * @param {string} sellerId - The ID of the seller
     * @returns {Promise} Promise resolving to an array of vehicles
     */
    function getSellerVehicles(sellerId) {
      return DbService.getIndex('vehicles', 'vehicle_owner_id', 'readonly')
        .then(function(index) {
          return $q(function(resolve, reject) {
            try {
              const request = index.getAll(sellerId);
              
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
        });
    }
    
    /**
     * @param {Array} vehicles - List of vehicles
     * @param {Array} bookings - List of bookings
     * @param {Array} bids - List of bids
     * @param {Array} conversations - List of conversations
     * @returns {Object} Computed statistics
     */
    function computeStats(vehicles, bookings, bids, conversations) {
      const stats = {};
      // Total revenue
      stats.totalRevenue = calculateTotalRevenue(bookings);
      // Average booking duration
      stats.avgBookingDuration = calculateAvgBookingDuration(bookings);
      
      // Most queried vehicle
      stats.mostQueriedVehicle = findMostQueriedVehicle(conversations);
      
      // Most bidded vehicle
      stats.mostBiddedVehicle = findMostBiddedVehicle(bids);
      
      return stats;
    }
    
    function renderCharts(stats, sellerVehicles) {
      clearCharts();
      renderMostBiddedChart('mostBiddedChart', stats.mostBiddedVehicle, sellerVehicles);
      renderConversionRateChart('conversionRateChart', stats);
      
      if (document.getElementById('activeLocationChart')) {
        renderLocationChart('activeLocationChart', sellerVehicles);
      }
      
      if (document.getElementById('priceCompetitivenessChart')) {
        renderPriceCompetitivenessChart('priceCompetitivenessChart', sellerVehicles);
      }
      
      if (document.getElementById('bidVsRentalChart')) {
        renderBidVsRentalChart('bidVsRentalChart', sellerVehicles);
      }
      
      if (document.getElementById('mostRentedChart')) {
        renderMostRentedChart('mostRentedChart', stats.mostRentedVehicleData, sellerVehicles);
      }
      

      if (document.getElementById('outstationLocalChart')) {
        renderOutstationVsLocalChart('outstationLocalChart', stats.outstationStats);
      }
      
      if (document.getElementById('avgBookingDurationByTypeChart')) {
        renderAvgBookingDurationByTypeChart('avgBookingDurationByTypeChart', stats.bookingDurationByType);
      }
      
      if (document.getElementById('avgBidAmountByTypeChart')) {
        renderAvgBidAmountByTypeChart('avgBidAmountByTypeChart', stats.bidAmountByType);
      }
    }
    /**
     * Calculates total revenue from bookings
     * @param {Array} bookings - List of bookings
     * @returns {number} Total revenue
     */
    function calculateTotalRevenue(bookings) {
      return bookings.reduce(function(sum, booking) {
        return sum + (booking.booking_amount || 0);
      }, 0);
    }
    
    /**
     * Calculates average booking duration in days
     * @param {Array} bookings - List of bookings
     * @returns {string} Average booking duration (fixed to 1 decimal)
     */
    function calculateAvgBookingDuration(bookings) {
      if (!bookings.length) return 0;
      
      const totalDuration = bookings.reduce(function(sum, booking) {
        if (booking.booking_start_date && booking.booking_end_date) {
          const start = new Date(booking.booking_start_date);
          const end = new Date(booking.booking_end_date);
          return sum + ((end - start) / (1000 * 60 * 60 * 24) + 1);
        }
        return sum;
      }, 0);
      
      return (totalDuration / bookings.length).toFixed(1);
    }
    
    /**
     * Finds the most queried vehicle based on conversation history
     * @param {Array} conversations - List of conversations
     * @returns {Object} Most queried vehicle info
     */
    function findMostQueriedVehicle(conversations) {
      const vehicleQueryCount = {};
      
      conversations.forEach(function(c) {
        if (c.vehicle && c.vehicle.vehicle_id) {
          const vehicleId = c.vehicle.vehicle_id;
          vehicleQueryCount[vehicleId] = (vehicleQueryCount[vehicleId] || 0) + 1;
        }
      });
      const sorted = Object.entries(vehicleQueryCount).sort(function(a, b) {
        return b[1] - a[1];
      });
      
      if (!sorted.length) return "N/A";
      
      // Get the top vehicle's data
      const topVehicleId = sorted[0][0];
      const topVehicleConversation = conversations.find(function(c) {
        return c.vehicle && c.vehicle.vehicle_id === topVehicleId;
      });
      
      return {
        id: topVehicleId,
        model: topVehicleConversation.vehicle.model || topVehicleConversation.vehicle.name,
        queryCount: sorted[0][1]
      };
    }
    
    function findMostBiddedVehicle(bids) {
      const vehicleBidCount = {};
      
      bids.forEach(function(b) {
        if (b.vehicle && b.vehicle.vehicle_id) {
          const vehicleId = b.vehicle.vehicle_id;
          vehicleBidCount[vehicleId] = (vehicleBidCount[vehicleId] || 0) + 1;
        }
      });
      
      const sorted = Object.entries(vehicleBidCount).sort(function(a, b) {
        return b[1] - a[1];
      });
      
      if (!sorted.length) return "N/A";
      
      const topVehicleId = sorted[0][0];
      const topVehicleBid = bids.find(function(b) {
        return b.vehicle && b.vehicle.vehicle_id === topVehicleId;
      });
      
      return {
        id: topVehicleId,
        model: topVehicleBid.vehicle.model || topVehicleBid.vehicle.name,
        bidCount: sorted[0][1]
      };
    }
    
    function getOutstationStats(bookings) {
      let outstationCount = 0;
      let localCount = 0;
      let outstationRevenue = 0;
      let localRevenue = 0;
      const outstationDurations = [];
      const localDurations = [];
      
      bookings.forEach(function(booking) {
        const isOutstation = parseBoolean(booking.isOutstation);
        let revenue = 0;
        let duration = 0;
        
        if (booking.booking_start_date && booking.booking_end_date) {
          const start = new Date(booking.booking_start_date);
          const end = new Date(booking.booking_end_date);
          duration = ((end - start) / (1000 * 60 * 60 * 24)) + 1;
          
          if (booking.booking_amount) {
            revenue = duration * Number(booking.booking_amount);
          }
        }
        
        if (isOutstation) {
          outstationCount++;
          outstationRevenue += revenue;
          if (duration > 0) outstationDurations.push(duration);
        } else {
          localCount++;
          localRevenue += revenue;
          if (duration > 0) localDurations.push(duration);
        }
      });
      
      const outstationAvgDuration = outstationDurations.length ? 
        (outstationDurations.reduce(function(a, b) { return a + b; }, 0) / outstationDurations.length).toFixed(1) : 0;
      
      const localAvgDuration = localDurations.length ? 
        (localDurations.reduce(function(a, b) { return a + b; }, 0) / localDurations.length).toFixed(1) : 0;
      
      return {
        outstationCount: outstationCount,
        localCount: localCount,
        outstationRevenue: outstationRevenue.toFixed(2),
        localRevenue: localRevenue.toFixed(2),
        outstationAvgDuration: outstationAvgDuration,
        localAvgDuration: localAvgDuration,
        totalCount: outstationCount + localCount
      };
    }
    
    
    function clearCharts() {
      Chart.helpers.each(Chart.instances, function(instance) {
        instance.destroy();
      });
    }
    
    function renderPieChart(canvasId, labels, data, options) {
      const ctx = document.getElementById(canvasId).getContext("2d");
      const defaultOptions = { 
        responsive: true, 
        plugins: { legend: { position: "bottom" } } 
      };
      
      new Chart(ctx, {
        type: "pie",
        data: {
          labels: labels,
          datasets: [{ 
            data: data, 
            backgroundColor: ["#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#9b59b6"] 
          }]
        },
        options: options || defaultOptions
      });
    }
    
    function renderBarChart(canvasId, labels, datasets, options) {
      const ctx = document.getElementById(canvasId).getContext("2d");
      const defaultOptions = { 
        responsive: true, 
        scales: { y: { beginAtZero: true } } 
      };
      
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: datasets
        },
        options: options || defaultOptions
      });
    }
    
    function renderDoughnutChart(canvasId, labels, data, options) {
      const ctx = document.getElementById(canvasId).getContext("2d");
      const defaultOptions = { 
        responsive: true, 
        plugins: { legend: { position: "bottom" } } 
      };
      
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [{ 
            data: data, 
            backgroundColor: ["#2ecc71", "#e74c3c"] 
          }]
        },
        options: options || defaultOptions
      });
    }

    /**
     * Renders a most bidded vehicle chart
     * @param {string} canvasId - ID of the canvas element
     * @param {Object} mostBiddedVehicle - Most bidded vehicle info
     * @param {Array} vehicles - List of vehicles
     */
    function renderMostBiddedChart(canvasId, mostBiddedVehicle, vehicles) {
      renderPieChart(
        canvasId, 
        [mostBiddedVehicle.model || "Most Bidded", "Others"], 
        [mostBiddedVehicle.bidCount || 0, 100]
      );
    }
    
    /**
     * Renders a conversion rate chart
     * @param {string} canvasId - ID of the canvas element
     * @param {Object} stats - Statistics object
     */
    function renderConversionRateChart(canvasId, stats) {
      if (!stats.totalBookings && !stats.totalBids) {
        renderDoughnutChart(canvasId, ["No Data"], [1]);
        return;
      }
      
      const conversionRate = stats.totalBids ? (stats.totalBookings / stats.totalBids) * 100 : 0;
      
      renderDoughnutChart(
        canvasId,
        ["Converted", "Not Converted"],
        [stats.totalBookings, stats.totalBids - stats.totalBookings],
        {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: {
              display: true,
              text: `Conversion Rate: ${conversionRate.toFixed(1)}%`
            }
          }
        }
      );
    }
    
    /**
     * Renders a pie chart showing vehicle locations
     * @param {string} canvasId - ID of the canvas element
     * @param {Array} vehicles - List of vehicles
     */
    function renderLocationChart(canvasId, vehicles) {
      const locationCounts = {};
      
      vehicles.forEach(function(v) {
        const loc = v.location || "Unknown";
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      
      const labels = Object.keys(locationCounts);
      const data = labels.map(function(label) {
        return locationCounts[label];
      });
      
      renderPieChart(canvasId, labels, data);
    }
    
    /**
     * Renders a price competitiveness chart
     * @param {string} canvasId - ID of the canvas element
     * @param {Array} sellerVehicles - List of seller vehicles
     */
    function renderPriceCompetitivenessChart(canvasId, sellerVehicles) {
      return DbService.getAllRecords('vehicles')
        .then(function(allVehicles) {
          // Calculate market average
          const marketPrices = allVehicles.map(function(v) {
            return Number(v.pricing && v.pricing.basePrice || 0);
          }).filter(price => price > 0);
          
          const marketAvg = marketPrices.length > 0 ? 
            marketPrices.reduce(function(a, b) { return a + b; }, 0) / marketPrices.length : 0;
          
          // Calculate seller average
          const sellerPrices = sellerVehicles.map(function(v) {
            return Number(v.pricing && v.pricing.basePrice || 0);
          }).filter(price => price > 0);
          
          const sellerAvg = sellerPrices.length > 0 ? 
            sellerPrices.reduce(function(a, b) { return a + b; }, 0) / sellerPrices.length : 0;
          
          renderBarChart(
            canvasId,
            ["Your Avg Price", "Market Avg Price"],
            [{
              label: "Base Rental Price",
              data: [sellerAvg.toFixed(2), marketAvg.toFixed(2)],
              backgroundColor: ["#2ecc71", "#e74c3c"]
            }],
            {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Price (Rs)'
                  }
                }
              },
              plugins: {
                legend: {
                  display: false
                }
              }
            }
          );
        });
    }

    /**
     * Renders a bid vs rental chart
     * @param {string} canvasId - ID of the canvas element
     * @param {Array} sellerVehicles - List of seller vehicles
     */
    function renderBidVsRentalChart(canvasId, sellerVehicles) {
      if (!sellerVehicles || !sellerVehicles.length) {
        console.log('No vehicles to display');
        return $q.when();
      }

      return DbService.getStore('bidding', 'readonly')
        .then(function(store) {
          return $q(function(resolve, reject) {
            const request = store.getAll();
            request.onsuccess = function(event) {
              resolve(event.target.result || []);
            };
            request.onerror = function(event) {
              reject(event.target.error);
            };
          });
        })
        .then(function(allBids) {
          const chartData = sellerVehicles.map(function(vehicle) {
            const vehicleBids = allBids.filter(function(bid) {
              return bid.vehicle && bid.vehicle.vehicle_id === vehicle.vehicle_id;
            });
            
            const avgBid = vehicleBids.length > 0 ? 
              vehicleBids.reduce(function(sum, b) {
                return sum + Number(b.bid_amount || 0);
              }, 0) / vehicleBids.length : 0;

            return {
              model: vehicle.vehicleModel || 'Unknown Model', 
              minRental: Number(vehicle.pricing && vehicle.pricing.basePrice || 0), 
              avgBid: avgBid
            };
          });
          console.log('Processed chart data:', chartData);

          // Filter out vehicles with no data
          const validData = chartData.filter(d => d.minRental > 0 || d.avgBid > 0);

          if (!validData.length) {
            console.log('No valid data to display');
            return;
          }

          renderBarChart(
            canvasId,
            validData.map(d => d.model),
            [
              {
                label: "Base Price",
                data: validData.map(d => d.minRental),
                backgroundColor: "#e74c3c"
              },
              {
                label: "Avg Bid Amount",
                data: validData.map(d => d.avgBid),
                backgroundColor: "#2ecc71"
              }
            ],
            {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Amount (Rs)'
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }
          );
        })
        .catch(function(error) {
          console.error('Error rendering bid vs rental chart:', error);
        });
    }
    
    function renderMostRentedChart(canvasId, mostRentedData, sellerVehicles) {
      if (!mostRentedData) {
        renderDoughnutChart(canvasId, ["No Data"], [1]);
        return;
      }
      
      const matchingVehicle = sellerVehicles.find(function(v) {
        return v.vehicle_id === mostRentedData.vehicleId;
      });
      
      const vehicleModel = matchingVehicle ? matchingVehicle.vehicle_model : "Unknown";
      
      renderDoughnutChart(
        canvasId,
        [vehicleModel, "Others"],
        [mostRentedData.count, mostRentedData.totalBookings - mostRentedData.count]
      );
    }
    
    function renderOutstationVsLocalChart(canvasId, outstationStats) {
      if (!outstationStats) {
        renderPieChart(canvasId, ["No Data"], [1]);
        return;
      }
      
      renderPieChart(
        canvasId,
        ["Outstation", "Local"],
        [outstationStats.outstationCount, outstationStats.localCount],
        {
          responsive: true,
          plugins: { 
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = outstationStats.totalCount;
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      );
    }
    
    function renderAvgBookingDurationByTypeChart(canvasId, durationData) {
      if (!durationData) {
        renderBarChart(canvasId, ["No Data"], [{ data: [0] }]);
        return;
      }
      
      renderBarChart(
        canvasId,
        ["Local", "Outstation"],
        [{
          label: "Average Booking Duration (days)",
          data: [durationData.localAvgDuration, durationData.outstationAvgDuration],
          backgroundColor: ["#3498db", "#9b59b6"]
        }]
      );
    }
    
    function renderAvgBidAmountByTypeChart(canvasId, bidData) {
      if (!bidData) {
        renderBarChart(canvasId, ["No Data"], [{ data: [0] }]);
        return;
      }
      
      renderBarChart(
        canvasId,
        ["Local", "Outstation"],
        [{
          label: "Average Bid Amount (Rs)",
          data: [bidData.localAvgAmount, bidData.outstationAvgAmount],
          backgroundColor: ["#2ecc71", "#e74c3c"]
        }]
      );
    }
    
    /**
     * Parses various value types into boolean
     * @param {*} val - Value to convert to boolean
     * @returns {boolean} Parsed boolean value
     */
    function parseBoolean(val) {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() === "true";
      return false;
    }
    
    /////////////////////
    // New methods
    
    function getTotalUsers() {
      return DbService.getAllRecords('users')
        .then(function(users) {
          return users.length;
        });
    }
    
    function getTotalVehicles() {
      return DbService.getAllRecords('vehicles')
        .then(function(vehicles) {
          return vehicles.length;
        });
    }
    
    function getTotalBookings() {
      return DbService.getAllRecords('bookings')
        .then(function(bookings) {
          return bookings.length;
        });
    }
    
    function getTotalBids() {
      return DbService.getAllRecords('bidding')
        .then(function(bids) {
          return bids.length;
        });
    }
    
    function getTotalMessages() {
      return DbService.getAllRecords('conversations')
        .then(function(messages) {
          return messages.length;
        });
    }
    
    function getTotalRevenue() {
      return DbService.getAllRecords('bookings')
        .then(function(bookings) {
          return calculateTotalRevenue(bookings);
        });
    }
  }
  