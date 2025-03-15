'use strict';

angular
  .module('carRentalApp')
  .service('BiddingService', BiddingService);

BiddingService.$inject = ['$q', 'DbService', 'AuthService', 'MessagingService'];

function BiddingService($q, DbService, AuthService, MessagingService) {
  const service = {
    getHighestBid: getHighestBid,
    placeBid: placeBid,
    createOrNavigateConversation: createOrNavigateConversation,
    getVehicleOwner: getVehicleOwner,
    getVehicleWithOwner: getVehicleWithOwner,
    markVehicleOutstation: markVehicleOutstation,
    loadBids: loadBids
  };

  return service;

  /** 
   * Returns the highest bid amount for a vehicle.
   * @param {string} vehicleId - The vehicle ID
   * @return {Promise} A promise that resolves with the highest bid amount
   */
  function getHighestBid(vehicleId) {
    return DbService.getStore('bidding', 'readonly')
      .then(function(store) {
        const deferred = $q.defer();
        const request = store.getAll();

        request.onsuccess = function(e) {
          const allBids = e.target.result || [];
          const bids = allBids.filter(function(bid) {
            const bidVehicleId = bid.vehicle_id || (bid.vehicle && bid.vehicle.vehicle_id);
            return bidVehicleId === vehicleId;
          });

          if (!bids.length) {
            return deferred.resolve(null);
          }

          const highestBid = Math.max(...bids.map(function(bid) {
            return Number(bid.bid_amount);
          }));
          deferred.resolve(highestBid);
        };

        request.onerror = function(e) {
          console.error("Error fetching bids:", e.target.error);
          deferred.reject(e.target.error);
        };

        return deferred.promise;
      })
      .catch(function(error) {
        console.error("Error in getHighestBid:", error);
        return null;
      });
  }

  /**
   * Places a bid after validation checks
   * @param {Object} bidData - The bid data object
   * @returns {Promise} Promise that resolves when bid is placed
   */
  function placeBid(bidData) {
    if (!AuthService.getLoggedInUser()) {
      return $q.reject("User not logged in.");
    }

    return validateBidRequest(bidData)
      .then(createBidRecord)
      .then(saveBidAndNotify);
  }

  /**
   * Validates the bid request
   * @param {Object} bidData - The bid data to validate
   * @returns {Promise} Promise resolving with validated data
   */
  function validateBidRequest(bidData) {
    const currentUser = AuthService.getLoggedInUser();
    
    return getVehicleWithOwner(bidData.vehicleId)
      .then(function(vehicleData) {
        if (vehicleData.seller.user_id === currentUser.user_id) {
          return $q.reject("You cannot place a bid on your own car.");
        }

        return checkOverlappingBids(bidData)
          .then(function(hasOverlap) {
            if (hasOverlap) {
              return $q.reject("Your bid dates overlap with an existing bid. Please choose different dates.");
            }
            return { 
              vehicleData: vehicleData, 
              currentUser: currentUser,
              bidData: bidData 
            };
          });
      });
  }

  /**
   * Creates the bid record object
   * @param {Object} data - The validated bid data
   * @returns {Object} The formatted bid record
   */
  function createBidRecord(data) {
    const bidRecord = {
      bid_id: crypto.randomUUID(),
      vehicle: {
        vehicle_id: data.vehicleData.vehicle_id,
        name: data.vehicleData.name,
        model: data.vehicleData.model,
        year: data.vehicleData.year,
        photos: data.vehicleData.photos
      },
      bidder: {
        user_id: data.currentUser.user_id,
        name: data.currentUser.first_name || data.currentUser.username,
        photoURL: data.currentUser.photoURL || "",
        govtId: data.currentUser.user_govtId || data.bidData.driverLicense
      },
      seller: {
        user_id: data.vehicleData.seller.user_id,
        name: data.vehicleData.seller.name,
        photoURL: data.vehicleData.seller.photoURL
      },
      bid_amount: data.bidData.bidAmount,
      bid_status: "Active",
      bid_date: new Date().toISOString(),
      booking_start_date: data.bidData.bidStartDate,
      booking_end_date: data.bidData.bidEndDate,
      isOutstation: data.bidData.isOutstation
    };

    return {
      bidRecord: bidRecord,
      vehicleData: data.vehicleData,
      currentUser: data.currentUser
    };
  }

  /**
   * Saves the bid and sends notification
   * @param {Object} data - The bid data to save
   * @returns {Promise} Promise resolving when bid is saved
   */
  function saveBidAndNotify(data) {
    const conversationId = [data.currentUser.user_id, data.vehicleData.seller.user_id]
      .sort()
      .join('_');

    const notificationText = formatBidNotification(data.bidRecord, data.vehicleData);

    return MessagingService.createConversationIfNotExists(
      conversationId,
      data.currentUser.user_id,
      data.vehicleData.seller.user_id,
      data.vehicleData.vehicle_id
    )
    .then(function() {
      return $q.all([
        DbService.addRecord('bidding', data.bidRecord),
        MessagingService.sendMessage(conversationId, notificationText, null)
      ]);
    });
  }

  /**
   * Formats the bid notification message
   * @param {Object} bidRecord - The bid record
   * @param {Object} vehicleData - The vehicle data
   * @returns {string} Formatted notification message
   */
  function formatBidNotification(bidRecord, vehicleData) {
    return [
      "New bid placed for " + (vehicleData.name || vehicleData.model),
      "Amount: Rs " + bidRecord.bid_amount,
      "Duration: " + bidRecord.booking_start_date + " to " + bidRecord.booking_end_date,
      "Outstation: " + (bidRecord.isOutstation ? 'Yes' : 'No')
    ].join('\n');
  }

  /**
   * Checks if bid dates overlap with existing bids
   * @param {Object} bidData - The bid data to check
   * @returns {Promise<boolean>} Promise resolving with overlap status
   */
  function checkOverlappingBids(bidData) {
    return DbService.getIndex('bidding', 'vehicle_id', 'readonly')
      .then(function(index) {
        const deferred = $q.defer();
        const request = index.getAll(bidData.vehicleId);

        request.onsuccess = function(e) {
          const bids = e.target.result || [];
          const newStart = new Date(bidData.bidStartDate).getTime();
          const newEnd = new Date(bidData.bidEndDate).getTime();
          
          const overlapping = bids.some(function(bid) {
            const existingStart = new Date(bid.booking_start_date).getTime();
            const existingEnd = new Date(bid.booking_end_date).getTime();
            return (existingStart <= newEnd && newStart <= existingEnd);
          });
          
          deferred.resolve(overlapping);
        };

        request.onerror = function(e) {
          deferred.reject(e.target.error);
        };

        return deferred.promise;
      });
  }

  /**
   * Creates or navigates to an existing conversation
   * @param {string} vehicleId - The vehicle ID
   * @param {string} bidderId - The bidder's ID
   * @param {string} sellerId - The seller's ID
   * @returns {Promise<string>} Promise resolving with conversation ID
   */
  function createOrNavigateConversation(vehicleId, bidderId, sellerId) {
    const conversationId = [bidderId, sellerId].sort().join('_');
    return MessagingService.createConversationIfNotExists(
      conversationId,
      bidderId,
      sellerId,
      vehicleId
    )
    .then(function() {
      return conversationId;
    });
  }

  /**
   * Gets the vehicle owner's ID
   * @param {string} vehicleId - The vehicle ID
   * @returns {Promise<string>} Promise resolving with owner ID
   */
  function getVehicleOwner(vehicleId) {
    return DbService.getRecord('vehicles', vehicleId)
      .then(function(vehicle) {
        if (!vehicle) {
          return $q.reject("Vehicle not found");
        }
        return vehicle.vehicle_owner_id;
      });
  }

  /**
   * Marks a vehicle as outstation
   * @param {string} vehicleId - The vehicle ID
   * @returns {Promise} Promise resolving when update is complete
   */
  function markVehicleOutstation(vehicleId) {
    return DbService.getRecord('vehicles', vehicleId)
      .then(function(vehicle) {
        if (!vehicle) {
          return $q.reject("Vehicle not found");
        }
        vehicle.isOutstation = true;
        return DbService.updateRecord('vehicles', vehicle);
      })
      .catch(function(err) {
        console.error("Error marking vehicle outstation:", err);
        return $q.reject(err);
      });
  }

  /**
   * Retrieves vehicle data along with owner's details
   * @param {string} vehicleId - The vehicle ID
   * @returns {Promise<Object>} Promise resolving with vehicle and owner data
   */
  function getVehicleWithOwner(vehicleId) {
    return DbService.getRecord('vehicles', vehicleId)
      .then(function(vehicle) {
        if (!vehicle) {
          return $q.reject("Vehicle not found");
        }
        return DbService.getRecord('users', vehicle.vehicle_owner_id)
          .then(function(owner) {
            if (!owner) {
              return $q.reject("Vehicle owner not found");
            }
            return {
              vehicle_id: vehicle.vehicle_id,
              name: vehicle.vehicleModel,
              model: vehicle.vehicleModel,
              year: vehicle.year || '',
              photos: vehicle.images_URL,
              seller: {
                user_id: owner.user_id,
                name: owner.business_name || owner.username,
                photoURL: owner.photoURL || ''
              }
            };
          });
      });
  }

  /**
   * Loads bids for the logged-in user with optional status filter
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>} Promise resolving with filtered bids
   */
  function loadBids(status) {
    const user = AuthService.getLoggedInUser();
    if (!user) {
      console.error("No user logged in");
      return $q.when([]);
    }

    return DbService.getStore('bidding', 'readonly')
      .then(function(store) {
        const deferred = $q.defer();
        const request = store.getAll();

        request.onsuccess = function(event) {
          const allBids = event.target.result || [];
          const isSeller = user.user_role.indexOf('seller') !== -1;
          
          let filteredBids = allBids.filter(function(bid) {
            if (isSeller) {
              return bid.seller && String(bid.seller.user_id) === String(user.user_id);
            }
            return bid.bidder && String(bid.bidder.user_id) === String(user.user_id);
          });

          if (status) {
            filteredBids = filteredBids.filter(function(bid) {
              return String(bid.bid_status).toLowerCase() === String(status).toLowerCase();
            });
          }

          deferred.resolve(filteredBids);
        };

        request.onerror = function(event) {
          console.error("Error loading bids:", event.target.error);
          deferred.reject(event.target.error);
        };

        return deferred.promise;
      })
      .catch(function(error) {
        console.error("Error in loadBids:", error);
        return [];
      });
  }
}
