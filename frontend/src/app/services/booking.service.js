'use strict';

angular
  .module('carRentalApp')
  .service('BookingService', BookingService);

BookingService.$inject = ['$q', '$http', 'DbService', 'AuthService', '$rootScope'];

function BookingService($q, $http, DbService, AuthService, $rootScope) {
  // Base URL for API endpoints
  const API_BASE_URL = 'http://localhost:5050/api/v1';

  // Auth token helper function (reused from BiddingService)
  function getAuthToken(user) {
    // Check if we have a user object with a token
    if (user && user.token) {
      return user.token;
    }
    
    // Check sessionStorage for a token
    const storedToken = sessionStorage.getItem('auth_token');
    if (storedToken) {
      return storedToken;
    }
    
    // Last resort, check if we have a token in $rootScope
    if ($rootScope.authToken) {
      return $rootScope.authToken;
    }
    
    return null;
  }

  // Service methods
  const service = {
    convertBidToBooking: convertBidToBooking,
    acceptAndConvertBid: acceptAndConvertBid,
    getSellerBookings: getSellerBookings,
    getRenterBookings: getRenterBookings,
    getBookingById: getBookingById,
    updateBookingStatus: updateBookingStatus,
    startTrip: startTrip,
    completeTrip: completeTrip,
    cancelBooking: cancelBooking,
    addBookingReview: addBookingReview
  };

  return service;

  /**
   * Convert an accepted bid to a booking
   * @param {string} bidId - The bid ID to convert to a booking
   * @returns {Promise} Promise resolving with the API response data
   */
  function convertBidToBooking(bidId) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to convert a bid to a booking");
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
      url: `${API_BASE_URL}/bookings/convert-bid/${bidId}`,
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
      console.error("Error converting bid to booking:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to convert bid to booking. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }

  /**
   * Accept a bid and then convert it to a booking in one operation
   * @param {string} bidId - The bid ID to accept and convert
   * @param {string} customMessage - Optional custom message to send to bidder
   * @returns {Promise} Promise resolving with the API response data 
   */
  function acceptAndConvertBid(bidId, customMessage) {
    const deferred = $q.defer();
    
    if (!bidId) {
      deferred.reject("Bid ID is required");
      return deferred.promise;
    }
    
    // Get authentication token from the logged in user
    const user = AuthService.getLoggedInUser();
    const token = getAuthToken(user);
    
    // This service will now rely on an external service to handle the bid response
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/bids/${bidId}/respond`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        response: 'accepted',
        message: customMessage || ''
      },
      withCredentials: true
    })
    .then(function() {
      // After successful acceptance, convert to booking
        return convertBidToBooking(bidId);
      })
    .then(function(bookingData) {
      deferred.resolve(bookingData);
      })
      .catch(function(error) {
        deferred.reject(error);
      });
    
    return deferred.promise;
  }

  /**
   * Get bookings for the currently logged in seller
   * @param {string} status - Filter bookings by status
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of items per page
   * @returns {Promise<Object>} Promise resolving with seller bookings data and pagination info
   */
  function getSellerBookings(status, page = 1, limit = 15) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to view your bookings");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    const params = {
      page: page,
      limit: limit
    };
    
    if (status) {
      params.status = status.toLowerCase();
    }
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bookings/seller`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: params,
      withCredentials: true
    })
    .then(function(response) {
      // Return raw API response without factory transformation
      deferred.resolve(response.data);
    })
    .catch(function(error) {
      console.error("Error loading seller bookings:", error);
      // Fallback to IndexedDB
      DbService.getStore('bookings', 'readonly')
        .then(function(store) {
          return $q(function(resolve, reject) {
            const request = store.getAll();
            
            request.onsuccess = function(event) {
              const allBookings = event.target.result || [];
              
              // Filter by seller and status
              let filteredBookings = allBookings.filter(function(booking) {
                if (!booking.seller || !booking.seller.user) return false;
                return booking.seller.user.toString() === user._id.toString();
              });
              
              if (status) {
                filteredBookings = filteredBookings.filter(function(booking) {
                  return booking.status.toLowerCase() === status.toLowerCase();
                });
              }
              
              // Paginate
              const startIndex = (page - 1) * limit;
              const endIndex = startIndex + limit;
              const paginatedBookings = filteredBookings.slice(startIndex, endIndex);
              
              const result = {
                data: paginatedBookings,
                pagination: {
                  page: page,
                  limit: limit,
                  total: filteredBookings.length,
                  totalPages: Math.ceil(filteredBookings.length / limit),
                  hasNextPage: endIndex < filteredBookings.length,
                  hasPrevPage: page > 1
                }
              };
              
              resolve(result);
            };
            
            request.onerror = function(event) {
              reject("Error accessing local booking data");
            };
          });
        })
        .then(function(result) {
          deferred.resolve(result);
        })
        .catch(function(error) {
          deferred.reject("Failed to load bookings. Please try again.");
        });
    });
    
    return deferred.promise;
  }

  /**
   * Get bookings for the currently logged in renter
   * @param {string} status - Filter bookings by status
   * @param {number} page - Page number for pagination
   * @param {number} limit - Number of items per page
   * @returns {Promise<Object>} Promise resolving with renter bookings data and pagination info
   */
  function getRenterBookings(status, page = 1, limit = 15) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to view your bookings");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    const params = {
      page: page,
      limit: limit
    };
    
    if (status) {
      params.status = status.toLowerCase();
    }
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bookings/renter`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: params,
      withCredentials: true
    })
    .then(function(response) {
      // Return raw API response without factory transformation
      deferred.resolve(response.data);
    })
    .catch(function(error) {
      console.error("Error loading renter bookings:", error);
      // Fallback to IndexedDB
      DbService.getStore('bookings', 'readonly')
        .then(function(store) {
          return $q(function(resolve, reject) {
            const request = store.getAll();
            
            request.onsuccess = function(event) {
              const allBookings = event.target.result || [];
              
              // Filter by renter and status
              let filteredBookings = allBookings.filter(function(booking) {
                if (!booking.renter || !booking.renter.user) return false;
                return booking.renter.user.toString() === user._id.toString();
              });
              
              if (status) {
                filteredBookings = filteredBookings.filter(function(booking) {
                  return booking.status.toLowerCase() === status.toLowerCase();
                });
              }
              
              // Paginate
              const startIndex = (page - 1) * limit;
              const endIndex = startIndex + limit;
              const paginatedBookings = filteredBookings.slice(startIndex, endIndex);
              
              const result = {
                data: paginatedBookings,
                pagination: {
                  page: page,
                  limit: limit,
                  total: filteredBookings.length,
                  totalPages: Math.ceil(filteredBookings.length / limit),
                  hasNextPage: endIndex < filteredBookings.length,
                  hasPrevPage: page > 1
                }
              };
              
              resolve(result);
            };
            
            request.onerror = function(event) {
              reject("Error accessing local booking data");
            };
          });
        })
        .then(function(result) {
          deferred.resolve(result);
        })
        .catch(function(error) {
          deferred.reject("Failed to load bookings. Please try again.");
        });
    });
    
    return deferred.promise;
  }

  /**
   * Get a booking by its ID
   * @param {string} bookingId - The booking ID to retrieve
   * @returns {Promise<Object>} Promise resolving with booking data
   */
  function getBookingById(bookingId) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to view booking details");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    $http({
      method: 'GET',
      url: `${API_BASE_URL}/bookings/${bookingId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    })
    .then(function(response) {
      // Return raw API response data
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error loading booking details:", error);
      // Fallback to IndexedDB
      DbService.getStore('bookings', 'readonly')
        .then(function(store) {
          return $q(function(resolve, reject) {
            const request = store.get(bookingId);
            
            request.onsuccess = function(event) {
              const bookingData = event.target.result;
              if (bookingData) {
                resolve(bookingData);
              } else {
                reject("Booking not found in local database");
              }
            };
            
            request.onerror = function(event) {
              reject("Error accessing local booking data");
            };
          });
        })
        .then(function(bookingData) {
          deferred.resolve(bookingData);
        })
        .catch(function(error) {
          deferred.reject("Failed to load booking details. Please try again.");
        });
    });
    
    return deferred.promise;
  }

  /**
   * Update a booking's status
   * @param {string} bookingId - The booking ID to update
   * @param {string} status - The new status value
   * @param {Object} additionalData - Any additional data to include in the update
   * @returns {Promise<Object>} Promise resolving with updated booking data
   */
  function updateBookingStatus(bookingId, status, additionalData = {}) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to update booking status");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    if (!status) {
      deferred.reject("New status value is required");
      return deferred.promise;
    }
    
    // Prepare update data
    const updateData = {
      status: status,
      ...additionalData
    };
    
    $http({
      method: 'PATCH',
      url: `${API_BASE_URL}/bookings/${bookingId}/status`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: updateData,
      withCredentials: true
    })
    .then(function(response) {
      // Return raw API response data
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error updating booking status:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to update booking status. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }

  /**
   * Start a trip by updating the booking status and recording odometer reading
   * @param {string} bookingId - The booking ID
   * @param {number} odometerReading - The starting odometer reading
   * @returns {Promise<Object>} Promise resolving with updated booking data
   */
  function startTrip(bookingId, odometerReading) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to start a trip");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }

    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    if (odometerReading === undefined || odometerReading === null) {
      deferred.reject("Starting odometer reading is required");
      return deferred.promise;
    }

    // Ensure odometer reading is a number and convert to string to avoid precision issues
    const numericReading = parseFloat(odometerReading);
    console.log(`[BookingService] Starting trip for booking ${bookingId} with odometer reading: ${numericReading}`);

    // Create data object with all required fields
    const tripData = {
      status: 'in_progress',
      initial_odometer_reading: numericReading,
      trip_start_time: new Date().toISOString()
    };

    console.log('[BookingService] Sending trip start data:', JSON.stringify(tripData));

    // Make a direct PUT request instead of PATCH to ensure full update
    $http({
      method: 'PUT',
      url: `${API_BASE_URL}/bookings/${bookingId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: tripData,
      withCredentials: true
    })
    .then(function(response) {
      console.log('[BookingService] Trip started successfully, response:', response.data);
      
      // Verify the response has the correct initial_odometer_reading
      const responseData = response.data.data;
      if (responseData.initial_odometer_reading === undefined || 
          responseData.initial_odometer_reading === null || 
          isNaN(parseFloat(responseData.initial_odometer_reading))) {
        
        console.warn('[BookingService] Initial odometer reading not returned correctly in response, adding it manually');
        responseData.initial_odometer_reading = numericReading;
      }
      
      // Save to local storage as a backup
      try {
        localStorage.setItem(`booking_${bookingId}_initial_odometer`, numericReading.toString());
      } catch (e) {
        console.warn('[BookingService] Could not save initial odometer to localStorage:', e);
      }
      
      deferred.resolve(responseData);
    })
    .catch(function(error) {
      console.error('[BookingService] Error starting trip:', error);
      
      // Fallback to PATCH if PUT fails
      console.log('[BookingService] Trying alternative PATCH endpoint for backward compatibility');
      $http({
        method: 'PATCH',
        url: `${API_BASE_URL}/bookings/${bookingId}/status`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: tripData,
        withCredentials: true
      })
      .then(function(response) {
        console.log('[BookingService] Trip started successfully with PATCH, response:', response.data);
        
        // Verify the response has the correct initial_odometer_reading
        const responseData = response.data.data;
        if (responseData.initial_odometer_reading === undefined || 
            responseData.initial_odometer_reading === null || 
            isNaN(parseFloat(responseData.initial_odometer_reading))) {
          
          console.warn('[BookingService] Initial odometer reading not returned correctly in response, adding it manually');
          responseData.initial_odometer_reading = numericReading;
        }
        
        // Save to local storage as a backup
        try {
          localStorage.setItem(`booking_${bookingId}_initial_odometer`, numericReading.toString());
        } catch (e) {
          console.warn('[BookingService] Could not save initial odometer to localStorage:', e);
        }
        
        deferred.resolve(responseData);
      })
      .catch(function(patchError) {
        console.error('[BookingService] Error starting trip with PATCH:', patchError);
        const errorMessage = error.data && error.data.message 
          ? error.data.message 
          : "Failed to start trip. Please try again.";
        deferred.reject(errorMessage);
      });
    });
    
    return deferred.promise;
  }

  /**
   * Complete a trip by updating the booking status and recording final details
   * @param {string} bookingId - The booking ID
   * @param {number} odometerReading - The final odometer reading
   * @param {number} extraCharges - Any additional charges
   * @returns {Promise<Object>} Promise resolving with updated booking data
   */
  function completeTrip(bookingId, odometerReading, extraCharges = 0) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to complete a trip");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
        return deferred.promise;
      }

    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    if (odometerReading === undefined || odometerReading === null) {
      deferred.reject("Final odometer reading is required");
      return deferred.promise;
    }

    // Ensure values are numeric
    const numericReading = parseFloat(odometerReading);
    const numericCharges = parseFloat(extraCharges || 0);
    
    console.log(`[BookingService] Completing trip for booking ${bookingId} with reading: ${numericReading}, charges: ${numericCharges}`);

    // Try to get the initial odometer reading from localStorage first
    let initialReading = null;
    try {
      const storedReading = localStorage.getItem(`booking_${bookingId}_initial_odometer`);
      if (storedReading) {
        initialReading = parseFloat(storedReading);
        console.log(`[BookingService] Retrieved initial odometer reading from localStorage: ${initialReading}`);
      }
    } catch (e) {
      console.warn('[BookingService] Could not get initial odometer from localStorage:', e);
    }

    // If we have a valid initial reading from localStorage, complete the trip directly
    if (initialReading !== null && !isNaN(initialReading)) {
      return completeWithInitialReading(initialReading);
    }
    
    // Otherwise get the booking from the server to find the initial reading
    return $http({
      method: 'GET',
      url: `${API_BASE_URL}/bookings/${bookingId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    })
    .then(function(response) {
      const bookingData = response.data.data;
      console.log('[BookingService] Retrieved booking data for completion:', bookingData);
      
      // Extract initial reading, defaulting to 0 if not present or invalid
      if (typeof bookingData.initial_odometer_reading === 'number') {
        initialReading = bookingData.initial_odometer_reading;
      } else if (bookingData.initial_odometer_reading) {
        initialReading = parseFloat(bookingData.initial_odometer_reading);
      } else {
        initialReading = 0;
      }
      
      if (isNaN(initialReading)) {
        console.warn('[BookingService] Invalid initial odometer reading, defaulting to 0');
        initialReading = 0;
      }
      
      return completeWithInitialReading(initialReading);
    })
    .catch(function(error) {
      console.error('[BookingService] Error retrieving booking for completion:', error);
      // If we cannot retrieve the booking, default initial reading to 0
      return completeWithInitialReading(0);
    });
    
    // Helper function to complete with a known initial reading
    function completeWithInitialReading(initialReading) {
      const totalKm = numericReading - initialReading;
      
      console.log(`[BookingService] Calculated total_km: ${totalKm} (${numericReading} - ${initialReading})`);
      
      // Get booking dates to calculate allowed kilometers
      return $http({
        method: 'GET',
        url: `${API_BASE_URL}/bookings/${bookingId}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      })
      .then(function(response) {
        const bookingData = response.data.data;
        
        // Calculate booking duration
        const startDate = new Date(bookingData.booking_start_date);
        const endDate = new Date(bookingData.booking_end_date);
        const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // Calculate allowed kilometers (100km per day)
        const allowedKilometers = durationDays * 100;
        
        // Calculate excess kilometers
        let excessKilometers = 0;
        if (totalKm > allowedKilometers) {
          excessKilometers = totalKm - allowedKilometers;
        }
        
        // Calculate kilometer charges (₹10 per excess km)
        const kmChargeRate = 10; // ₹ per km
        const kmCharges = excessKilometers * kmChargeRate;
        
        // Add kilometer charges to manual extra charges
        const totalExtraCharges = kmCharges + numericCharges;
        
        console.log(`[BookingService] Calculated charges:`, {
          durationDays,
          allowedKilometers,
          excessKilometers,
          kmCharges,
          manualExtraCharges: numericCharges,
          totalExtraCharges
        });
        
        const tripData = {
          status: 'completed',
          initial_odometer_reading: initialReading, // Always include initial reading
          final_odometer_reading: numericReading,
          total_km: totalKm > 0 ? totalKm : 0, // Ensure non-negative value
          extra_charges: totalExtraCharges,
          km_charges: kmCharges,
          excess_kilometers: excessKilometers,
          allowed_kilometers: allowedKilometers,
          trip_end_time: new Date().toISOString()
        };
        
        console.log('[BookingService] Sending trip completion data:', JSON.stringify(tripData));
        
        // First try with PUT to ensure full update
        return $http({
          method: 'PUT',
          url: `${API_BASE_URL}/bookings/${bookingId}`,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: tripData,
          withCredentials: true
        })
        .then(function(response) {
          console.log('[BookingService] Trip completed successfully with PUT:', response.data);
          
          // Clean up localStorage
          try {
            localStorage.removeItem(`booking_${bookingId}_initial_odometer`);
          } catch (e) {
            console.warn('[BookingService] Could not remove initial odometer from localStorage:', e);
          }
          
          deferred.resolve(response.data.data);
          return response.data.data;
      })
      .catch(function(error) {
          console.error('[BookingService] Error completing trip with PUT:', error);
          
          // Fallback to PATCH if PUT fails
          console.log('[BookingService] Trying alternative PATCH endpoint for backward compatibility');
          return $http({
            method: 'PATCH',
            url: `${API_BASE_URL}/bookings/${bookingId}/status`,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            data: tripData,
            withCredentials: true
          })
          .then(function(response) {
            console.log('[BookingService] Trip completed successfully with PATCH:', response.data);
            
            // Get the full booking to verify the readings were saved
            return $http({
              method: 'GET',
              url: `${API_BASE_URL}/bookings/${bookingId}`,
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              withCredentials: true
            })
            .then(function(getResponse) {
              console.log('[BookingService] Retrieved booking after completion:', getResponse.data);
              
              // Check if readings were stored
              const updatedBooking = getResponse.data.data;
              if (!updatedBooking.initial_odometer_reading || !updatedBooking.final_odometer_reading) {
                console.warn('[BookingService] Odometer readings not saved in database, sending additional update');
                
                // Explicitly send an update for the odometer readings if they weren't saved
                return $http({
                  method: 'PATCH',
                  url: `${API_BASE_URL}/bookings/${bookingId}`,
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  data: {
                    initial_odometer_reading: initialReading,
                    final_odometer_reading: numericReading,
                    total_km: totalKm > 0 ? totalKm : 0
                  },
                  withCredentials: true
                })
                .then(function(updateResponse) {
                  console.log('[BookingService] Updated odometer readings with separate call:', updateResponse.data);
                  
                  const responseData = updateResponse.data.data || updatedBooking;
                  // Clean up localStorage
                  try {
                    localStorage.removeItem(`booking_${bookingId}_initial_odometer`);
                  } catch (e) {
                    console.warn('[BookingService] Could not remove initial odometer from localStorage:', e);
                  }
                  
                  deferred.resolve(responseData);
                  return responseData;
                })
                .catch(function(updateError) {
                  console.error('[BookingService] Error updating odometer readings:', updateError);
                  
                  // Still return the original booking data even if the update failed
                  deferred.resolve(updatedBooking);
                  return updatedBooking;
                });
              }
              
              // Clean up localStorage
              try {
                localStorage.removeItem(`booking_${bookingId}_initial_odometer`);
              } catch (e) {
                console.warn('[BookingService] Could not remove initial odometer from localStorage:', e);
              }
              
              deferred.resolve(updatedBooking);
              return updatedBooking;
            })
            .catch(function(getError) {
              console.error('[BookingService] Error retrieving booking after completion:', getError);
              
              // Return the response from the PATCH if we can't get the full booking
              deferred.resolve(response.data.data);
              return response.data.data;
            });
          })
          .catch(function(patchError) {
            console.error('[BookingService] Error completing trip with PATCH:', patchError);
            const errorMessage = error.data && error.data.message 
              ? error.data.message 
              : "Failed to complete trip. Please try again.";
            deferred.reject(errorMessage);
            return $q.reject(errorMessage);
          });
        });
      })
      .catch(function(error) {
        console.error('[BookingService] Error retrieving booking for km calculation:', error);
        
        // Fallback to simple calculation without excess km charges
        const tripData = {
          status: 'completed',
          initial_odometer_reading: initialReading,
          final_odometer_reading: numericReading,
          total_km: totalKm > 0 ? totalKm : 0,
          extra_charges: numericCharges,
          trip_end_time: new Date().toISOString()
        };
        
        console.log('[BookingService] Sending basic trip completion data (fallback):', JSON.stringify(tripData));
        
        return $http({
          method: 'PATCH',
          url: `${API_BASE_URL}/bookings/${bookingId}/status`,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: tripData,
          withCredentials: true
        })
        .then(function(response) {
          console.log('[BookingService] Trip completed successfully (fallback):', response.data);
          
          // Clean up localStorage
          try {
            localStorage.removeItem(`booking_${bookingId}_initial_odometer`);
          } catch (e) {
            console.warn('[BookingService] Could not remove initial odometer from localStorage:', e);
          }
          
          deferred.resolve(response.data.data);
          return response.data.data;
        })
        .catch(function(error) {
          console.error('[BookingService] Error completing trip (fallback):', error);
          const errorMessage = error.data && error.data.message 
            ? error.data.message 
            : "Failed to complete trip. Please try again.";
          deferred.reject(errorMessage);
          return $q.reject(errorMessage);
        });
      });
    }
  }

  /**
   * Cancel a booking
   * @param {string} bookingId - The booking ID to cancel
   * @param {string} reason - The reason for cancellation
   * @returns {Promise<Object>} Promise resolving with cancelled booking data
   */
  function cancelBooking(bookingId, reason) {
    const deferred = $q.defer();
    
    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    const cancelData = {
      reason: reason || "Cancelled by user"
    };

    // Use the generic status update endpoint with cancellation data
    return updateBookingStatus(bookingId, 'cancelled', cancelData);
  }

  /**
   * Add a review to a booking
   * @param {string} bookingId - The booking ID to review
   * @param {number} rating - Rating value (1-5)
   * @param {string} comment - Review comment
   * @returns {Promise<Object>} Promise resolving with updated booking data
   */
  function addBookingReview(bookingId, rating, comment) {
    const deferred = $q.defer();
    
    const user = AuthService.getLoggedInUser();
    if (!user) {
      deferred.reject("You must be logged in to add a review");
      return deferred.promise;
    }
    
    // Get authentication token
    const token = getAuthToken(user);
    
    // Validate token
    if (!token) {
      deferred.reject("Authentication token missing. Please log in again.");
      return deferred.promise;
    }
    
    if (!bookingId) {
      deferred.reject("Booking ID is required");
      return deferred.promise;
    }
    
    if (!rating || rating < 1 || rating > 5) {
      deferred.reject("Rating must be between 1 and 5");
      return deferred.promise;
    }
    
    const reviewData = {
      rating: rating,
      comment: comment || ''
    };
    
    $http({
      method: 'POST',
      url: `${API_BASE_URL}/bookings/${bookingId}/review`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: reviewData,
      withCredentials: true
    })
    .then(function(response) {
      // Return raw API response data
      deferred.resolve(response.data.data);
    })
    .catch(function(error) {
      console.error("Error adding review:", error);
      const errorMessage = error.data && error.data.message 
        ? error.data.message 
        : "Failed to add review. Please try again.";
      deferred.reject(errorMessage);
    });
    
    return deferred.promise;
  }
}
