'use strict';

angular
  .module('carRentalApp')
  .service('BiddingService', BiddingService);

BiddingService.$inject = ['$q', '$http', 'DbService', 'AuthService', '$rootScope'];

function BiddingService($q, $http, DbService, AuthService, $rootScope) {
  // Base URL for API endpoints
  const API_BASE_URL = 'http://localhost:5050/api/v1';
  
  const service = {
    // Seller-related API calls
    loadSellerBids: loadSellerBids,
    respondToBid: respondToBid,
    
    // Bidder-related API calls
    loadBidderBids: loadBidderBids,
    submitBid: submitBid,
    cancelBid: cancelBid,
    
    // Common API calls
    getBidById: getBidById,
    getHighestBid: getHighestBid,
    getVehicleOwner: getVehicleOwner,
    
    // Additional utility functions
    createConversationIfNotExists: createConversationIfNotExists
  };

  return service;

  /**
   * Helper function to get authentication token from various sources
   * @param {Object} user - Current user object (optional)
   * @returns {string|null} Authentication token or null if not found
   */
  function getAuthToken(user) {
    // Try to get token from multiple sources
    let token = null;
    
    // Check if we have token from sessionStorage
    try {
      const sessionToken = sessionStorage.getItem('auth_token');
      if (sessionToken) {
        token = sessionToken;
      }
    } catch (e) {
      console.warn('Error retrieving token from sessionStorage:', e);
    }
    
    // Check if we have token from user object (as backup)
    if (!token && user && user.token) {
      token = user.token;
    }
    
    // Check if we have token from rootScope (as last resort)
    if (!token && $rootScope && $rootScope.token) {
      token = $rootScope.token;
    }
    
    return token;
  }

  /** 
   * Returns the highest bid amount for a vehicle.
   * @param {string} vehicleId - The vehicle ID
   * @return {Promise} A promise that resolves with the highest bid amount
   */
  function getHighestBid(vehicleId) {
    const deferred = $q.defer();
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bids/highest/${vehicleId}`
    })
    .then(function(response) {
      const highestBid = response.data.data?.highestBid || null;
      deferred.resolve(highestBid);
    })
    .catch(function(error) {
      console.error("Error fetching highest bid:", error);

      DbService.getStore('bidding', 'readonly')
        .then(function(store) {
          const storeDeferred = $q.defer();
          const request = store.getAll();

          request.onsuccess = function(e) {
            const allBids = e.target.result || [];
            const bids = allBids.filter(function(bid) {
              const bidVehicleId = bid.vehicle || (bid.vehicle && bid.vehicle.vehicle_id);
              return bidVehicleId === vehicleId;
            });

            if (!bids.length) {
              storeDeferred.resolve(null);
              return;
            }

            const highestBid = Math.max(...bids.map(function(bid) {
              return Number(bid.bid_amount);
            }));
            storeDeferred.resolve(highestBid);
          };

          request.onerror = function(e) {
            console.error("Error fetching bids:", e.target.error);
            storeDeferred.reject(e.target.error);
          };

          return storeDeferred.promise;
        })
        .then(function(highestBid) {
          deferred.resolve(highestBid);
        })
        .catch(function(err) {
          deferred.reject(err);
        });
    });
    
    return deferred.promise;
  }
  
  // ========================================================================
  // Seller-related API calls
  // ========================================================================
  
  /**
   * Loads bids for the current seller with optional status filtering
   * @param {string} status - Filter bids by this status if provided
   * @returns {Promise} Promise resolving to an array of bids
   */
  function loadSellerBids(status) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to view your seller bids");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bids/seller`,
          headers: {
        'Authorization': token ? `Bearer ${token}` : undefined
          },
          withCredentials: true,
      params: {
        status: status
      }
      })
      .then(function(response) {
      deferred.resolve(response.data.data || []);
    })
    .catch(function(error) {
      console.error("Error loading seller bids:", error);
      DbService.getStore('bidding', 'readonly')
        .then(function(store) {
          const storeDeferred = $q.defer();
          const request = store.getAll();

          request.onsuccess = function(event) {
            const allBids = event.target.result || [];
            let filteredBids = [];

            if (user && user.user_id) {
              filteredBids = allBids.filter(function(bid) {
                return bid.seller && String(bid.seller.user_id) === String(user.user_id);
              });
            } else {
              filteredBids = allBids;
            }

            if (status) {
              filteredBids = filteredBids.filter(function(bid) {
                return String(bid.bid_status).toLowerCase() === String(status).toLowerCase();
              });
            }

            storeDeferred.resolve(filteredBids);
          };

          request.onerror = function(event) {
            console.error("Error loading bids from indexedDB:", event.target.error);
            storeDeferred.reject(event.target.error);
          };

          return storeDeferred.promise;
        })
        .then(function(bids) {
          deferred.resolve(bids);
        })
        .catch(function(err) {
          deferred.reject(err);
        });
    });
    
    return deferred.promise;
  }
  
  /**
   * Respond to a bid (accept or reject)
   * @param {string} bidId - The ID of the bid to respond to
   * @param {string} response - The response type ("accepted" or "rejected")
   * @param {string} message - Optional message to include with the response
   * @returns {Promise} Promise resolving to the updated bid
   */
  function respondToBid(bidId, response, message) {
    const deferred = $q.defer();
    
    // Ensure we have a logged-in user
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to respond to bids");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    // Input validation
    if (!bidId) {
      deferred.reject("Bid ID is required");
      return deferred.promise;
    }
    
    // Validate the response status
    const validStatuses = ['accepted', 'rejected'];
    if (!validStatuses.includes(response)) {
      deferred.reject(`Invalid response: ${response}. Must be 'accepted' or 'rejected'`);
      return deferred.promise;
    }
    
    // Validate message length if provided
    if (message && message.length > 500) {
      deferred.reject("Response message is too long (maximum 500 characters)");
      return deferred.promise;
    }
    
    const requestData = {
      response: response,
      message: message || ''
    };
    
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/bids/${bidId}/respond`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      withCredentials: true
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error responding to bid:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to respond to the bid. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }
  
  // ========================================================================
  // Bidder-related API calls
  // ========================================================================
  
  /**
   * Loads bids placed by the current bidder with optional status filtering
   * @param {string} status - Filter bids by this status if provided
   * @returns {Promise} Promise resolving to an array of bids
   */
  function loadBidderBids(status) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to view your bids");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bids/bidder`,
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined
      },
      withCredentials: true,
      params: {
        status: status
      }
    })
    .then(function(response) {
      deferred.resolve(response.data.data || []);
    })
    .catch(function(error) {
      console.error("Error loading bidder bids:", error);
      DbService.getStore('bidding', 'readonly')
        .then(function(store) {
          const storeDeferred = $q.defer();
          const request = store.getAll();

          request.onsuccess = function(event) {
            const allBids = event.target.result || [];
            let filteredBids = [];

            if (user && user.user_id) {
              filteredBids = allBids.filter(function(bid) {
                return bid.bidder && String(bid.bidder.user_id) === String(user.user_id);
              });
            } else {
              filteredBids = allBids;
            }

            if (status) {
              filteredBids = filteredBids.filter(function(bid) {
                return String(bid.bid_status).toLowerCase() === String(status).toLowerCase();
              });
            }

            storeDeferred.resolve(filteredBids);
          };

          request.onerror = function(event) {
            console.error("Error loading bids from indexedDB:", event.target.error);
            storeDeferred.reject(event.target.error);
          };

          return storeDeferred.promise;
        })
        .then(function(bids) {
          deferred.resolve(bids);
        })
        .catch(function(err) {
          deferred.reject(err);
        });
    });
    
    return deferred.promise;
  }
  
  /**
   * Submit a new bid for a vehicle
   * @param {Object} bidData - The bid data to submit
   * @returns {Promise} Promise resolving to the created bid
   */
  function submitBid(bidData) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to submit a bid");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    // Basic validation
    if (!bidData.vehicleId && !bidData.vehicle) {
      deferred.reject("Vehicle ID is required");
      return deferred.promise;
    }
    
    // Use bid_amount from the Bidding object instance
    if (!bidData.bid_amount && bidData.bid_amount !== 0) {
      deferred.reject("Bid amount is required");
      return deferred.promise;
    }
    
    // Use booking_start_date from the Bidding object instance
    if (!bidData.booking_start_date) {
      deferred.reject("Booking start date is required");
      return deferred.promise;
    }
    
    // Use booking_end_date from the Bidding object instance
    if (!bidData.booking_end_date) {
      deferred.reject("Booking end date is required");
      return deferred.promise;
    }
    
    // Prepare the request payload using the Bidding object properties
    const payload = {
      vehicleId: bidData.vehicle, // Use vehicle from Bidding object
      bidAmount: parseFloat(bidData.bid_amount), // Use bid_amount
      bidMessage: bidData.bid_message || '', // Use bid_message
      bookingStartDate: bidData.booking_start_date, // Use booking_start_date
      bookingEndDate: bidData.booking_end_date, // Use booking_end_date
      isOutstation: !!bidData.is_outstation, // Use is_outstation
      govtId: bidData.govtId || null // Use govtId if it exists
    };
    
    // Add logging to see the exact payload being sent
    console.log('=== BiddingService Payload ===');
    console.log(payload);
    
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/bids`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: payload,
      withCredentials: true
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error submitting bid:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to submit bid. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }
  
  /**
   * Cancel a pending bid
   * @param {string} bidId - The ID of the bid to cancel
   * @returns {Promise} Promise resolving to the updated bid
   */
  function cancelBid(bidId) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to cancel a bid");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    if (!bidId) {
      deferred.reject("Bid ID is required");
      return deferred.promise;
    }
    
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/bids/${bidId}/cancel`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error cancelling bid:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to cancel bid. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }
  
  // ========================================================================
  // Common API calls
  // ========================================================================
  
  /**
   * Get a single bid by its ID
   * @param {string} bidId - The bid ID to retrieve
   * @returns {Promise} Promise resolving to the bid object
   */
  function getBidById(bidId) {
    const deferred = $q.defer();
    
    if (!bidId) {
      deferred.reject("Bid ID is required");
      return deferred.promise;
    }
    
    const user = AuthService.getLoggedInUser();
    const token = user ? getAuthToken(user) : null;
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bids/${bidId}`,
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      withCredentials: !!token
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error fetching bid:", error);
      // Try to get from indexedDB as fallback
      DbService.getRecord('bidding', bidId)
        .then(function(bid) {
          if (bid) {
            deferred.resolve(bid);
          } else {
            deferred.reject("Bid not found");
          }
        })
        .catch(function(err) {
          deferred.reject("Failed to fetch bid details");
        });
    });
    
    return deferred.promise;
  }
  
  /**
   * Get vehicle owner details for a given vehicle
   * @param {string} vehicleId - The vehicle ID
   * @returns {Promise} Promise resolving to the owner information
   */
  function getVehicleOwner(vehicleId) {
    const deferred = $q.defer();
    
    if (!vehicleId) {
      deferred.reject("Vehicle ID is required");
      return deferred.promise;
    }
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles/${vehicleId}/owner`
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error fetching vehicle owner:", error);
      // Fallback to locally stored vehicle data
      DbService.getRecord('vehicles', vehicleId)
        .then(function(vehicle) {
          if (vehicle && vehicle.owner_details) {
            deferred.resolve(vehicle.owner_details);
          } else {
            deferred.reject("Vehicle owner information not available");
          }
        })
        .catch(function(err) {
          deferred.reject("Failed to get vehicle owner information");
        });
    });
    
    return deferred.promise;
  }
  
  /**
   * Create a messaging conversation with the vehicle owner if it doesn't exist
   * @param {string} vehicleId - The vehicle ID
   * @returns {Promise} Promise resolving to the conversation ID
   */
  function createConversationIfNotExists(vehicleId) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to start a conversation");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    if (!vehicleId) {
      deferred.reject("Vehicle ID is required");
      return deferred.promise;
    }
    
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/messages/conversation/vehicle/${vehicleId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    })
    .then(function(response) {
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error creating conversation:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to create conversation. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }
}
