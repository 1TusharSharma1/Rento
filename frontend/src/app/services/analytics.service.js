"use strict";

angular.module("carRentalApp").service("AnalyticsService", AnalyticsService);

AnalyticsService.$inject = ["$http", "$q", "$rootScope"];

function AnalyticsService($http, $q, $rootScope) {
  const API_URL = "http://localhost:5050/api/v1/stats";
  
  // Function to get the current token
  function getToken() {
    if ($rootScope.token) {
      return $rootScope.token;
    }
    
    // If the page is reloaded by the user then, Fallback to sessionStorage
    try {
      return JSON.parse(sessionStorage.getItem('auth_token'));
    } catch (e) {
      console.error('Error parsing token from sessionStorage:', e);
      return null;
    }
  }

  const service = {
    // Core analytics methods
    getDashboardStats: getDashboardStats,
    getUserStats: getUserStats,
    getBookingStats: getBookingStats,
    getBiddingStats: getBiddingStats,
    getVehicleStats: getVehicleStats,
    renderPieChart: renderPieChart,
    renderBarChart: renderBarChart,
    renderDoughnutChart: renderDoughnutChart,
    renderLineChart: renderLineChart,
  };

  return service;
  /**
   * Get dashboard overview statistics
   * @returns {Promise} Promise resolving to dashboard statistics
   */
  function getDashboardStats() {
    const token = getToken();
    return $http
      .get(`${API_URL}/dashboard`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        withCredentials: true
      })
      .then((response) => response.data.data)
      .catch(handleError);
  }

  /**
   * Get user statistics
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (optional)
   * @param {string} params.endDate - End date (optional)
   * @param {string} params.timeUnit - Time unit (day, week, month, year)
   * @returns {Promise} Promise resolving to user statistics
   */
  function getUserStats(params = {}) {
    const token = getToken();
    return $http
      .get(`${API_URL}/users`, { 
        params,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        withCredentials: true
      })
      .then((response) => response.data.data)
      .catch(handleError);
  }

  /**
   * Get booking statistics
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (optional)
   * @param {string} params.endDate - End date (optional)
   * @param {string} params.timeUnit - Time unit (day, week, month, year)
   * @param {number} params.limit - Limit for top items lists
   * @returns {Promise} Promise resolving to booking statistics
   */
  function getBookingStats(params = {}) {
    const token = getToken();
    return $http
      .get(`${API_URL}/bookings`, { 
        params,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        withCredentials: true
      })
      .then((response) => response.data.data)
      .catch(handleError);
  }

  /**
   * Get bidding statistics
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Limit for top items lists
   * @returns {Promise} Promise resolving to bidding statistics
   */
  function getBiddingStats(params = {}) {
    const token = getToken();
    return $http
      .get(`${API_URL}/biddings`, { 
        params,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        withCredentials: true
      })
      .then((response) => response.data.data)
      .catch(handleError);
  }

  /**
   * Get vehicle statistics
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (optional)
   * @param {string} params.endDate - End date (optional)
   * @param {string} params.timeUnit - Time unit (day, week, month, year)
   * @param {string} params.inactiveSince - Date to check for inactive vehicles
   * @returns {Promise} Promise resolving to vehicle statistics
   */
  function getVehicleStats(params = {}) {
    const token = getToken();
    return $http
      .get(`${API_URL}/vehicles`, { 
        params,
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
        withCredentials: true
      })
      .then((response) => response.data.data)
      .catch(handleError);
  }

  /**
   * Error handler
   * @param {Object} error - Error object
   * @returns {Promise} Rejected promise with error
   */
  function handleError(error) {
    console.error("API error:", error);
    return $q.reject(error);
  }

  /**
   * Render a pie chart
   * @param {string} elementId - Canvas element ID
   * @param {Array} data - Chart data
   * @param {Array} labels - Chart labels
   * @param {Object} options - Chart options (optional)
   */
  function renderPieChart(elementId, data, labels, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const ctx = element.getContext("2d");

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      legend: {
        position: "right",
        labels: {
          padding: 20,
          boxWidth: 10,
        },
      },
    };

    new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [
              "rgba(255, 99, 132, 0.7)",
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 206, 86, 0.7)",
              "rgba(75, 192, 192, 0.7)",
              "rgba(153, 102, 255, 0.7)",
              "rgba(255, 159, 64, 0.7)",
              "rgba(199, 199, 199, 0.7)",
              "rgba(83, 102, 255, 0.7)",
              "rgba(40, 159, 164, 0.7)",
              "rgba(210, 199, 199, 0.7)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: { ...defaultOptions, ...options },
    });
  }

  /**
   * Render a bar chart
   * @param {string} elementId - Canvas element ID
   * @param {Array} data - Chart data
   * @param {Array} labels - Chart labels
   * @param {string} label - Dataset label
   * @param {Object} options - Chart options (optional)
   */
  function renderBarChart(elementId, data, labels, label, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const ctx = element.getContext("2d");

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    };

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: data,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          }
        ]
      },
      options: { ...defaultOptions, ...options }
    });
  }

  /**
   * Render a doughnut chart
   * @param {string} elementId - Canvas element ID
   * @param {Array} data - Chart data
   * @param {Array} labels - Chart labels
   * @param {Object} options - Chart options (optional)
   */
  function renderDoughnutChart(elementId, data, labels, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const ctx = element.getContext("2d");

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      legend: {
        position: "right",
        labels: {
          padding: 20,
          boxWidth: 10,
        },
      },
      cutoutPercentage: 70,
    };

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [
              "rgba(255, 99, 132, 0.7)",
              "rgba(54, 162, 235, 0.7)",
              "rgba(255, 206, 86, 0.7)",
              "rgba(75, 192, 192, 0.7)",
              "rgba(153, 102, 255, 0.7)",
              "rgba(255, 159, 64, 0.7)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: { ...defaultOptions, ...options },
    });
  }

  /**
   * Render a line chart
   * @param {string} elementId - Canvas element ID
   * @param {Array} data - Chart data
   * @param {Array} labels - Chart labels
   * @param {string} label - Dataset label
   * @param {Object} options - Chart options (optional)
   */
  function renderLineChart(elementId, data, labels, label, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const ctx = element.getContext("2d");

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    };

    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: data,
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
            pointRadius: 3,
            pointBackgroundColor: "rgba(75, 192, 192, 1)",
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "rgba(75, 192, 192, 1)",
            tension: 0.1
          }
        ]
      },
      options: { ...defaultOptions, ...options }
    });
  }
}
