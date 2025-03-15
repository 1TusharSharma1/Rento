
  'use strict';

  angular
    .module('carRentalApp')
    .service('SellerListingsService', SellerListingsService);

  SellerListingsService.$inject = ['$q', 'DbService', 'ValidationService', 'AuthService'];

  function SellerListingsService($q, DbService, ValidationService, AuthService) {
    const service = {
      loadListings: loadListings,
      deleteListing: deleteListing,
      listAgain: listAgain,
      addCar: addCar,
      loadSuperCategories: loadSuperCategories,
      loadCategories: loadCategories,
      saveNewSuperCategory: saveNewSuperCategory,
      saveNewCategory: saveNewCategory,
      getSuperCategoryByName: getSuperCategoryByName,
      getCategoryByName: getCategoryByName,
      loadBids: loadBids,
      autoRejectOverlappingBids: autoRejectOverlappingBids
    };
    return service;

    function loadListings(sellerId, availability) {
      return DbService.getStore("vehicles", "readonly")
        .then(function(store) {
          const index = store.index("vehicle_owner_id");
          return new Promise(function(resolve, reject) {
            const request = index.getAll(sellerId);
            request.onsuccess = function(event) {
              let listings = event.target.result || [];
              if (availability) {
                listings = listings.filter(function(vehicle) {
                  return vehicle.availability === availability;
                });
              }
              resolve(listings);
            };
            request.onerror = function() {
              reject(request.error);
            };
          });
        });
    }

    function deleteListing(vehicleId) {
      return DbService.getStore("vehicles", "readwrite")
        .then(function(store) {
          return new Promise(function(resolve, reject) {
            const req = store.get(vehicleId);
            req.onsuccess = function(e) {
              const vehicle = e.target.result;
              if (!vehicle) {
                return reject("Vehicle not found.");
              }
              vehicle.availability = "Unavailable";
              const updateReq = store.put(vehicle);
              updateReq.onsuccess = function() {
                resolve();
              };
              updateReq.onerror = function() {
                reject(updateReq.error);
              };
            };
            req.onerror = function() {
              reject(req.error);
            };
          });
        });
    }

    function listAgain(vehicleId) {
      return DbService.getStore("vehicles", "readwrite")
        .then(function(store) {
          return new Promise(function(resolve, reject) {
            const req = store.get(vehicleId);
            req.onsuccess = function(e) {
              const vehicle = e.target.result;
              if (!vehicle) {
                return reject("Vehicle not found.");
              }
              vehicle.availability = "Available";
              const updateReq = store.put(vehicle);
              updateReq.onsuccess = function() {
                resolve();
              };
              updateReq.onerror = function() {
                reject(updateReq.error);
              };
            };
            req.onerror = function() {
              reject(req.error);
            };
          });
        });
    }

    function addCar(carData, files) {
      if (!ValidationService.isNonEmptyString(carData.vehicleModel)) {
        return $q.reject("Vehicle model is required.");
      }
      if (!ValidationService.isNonEmptyString(carData.vehicleNumber)) {
        return $q.reject("Vehicle number is required.");
      }
      if (!carData.vehicle_owner_id) {
        return $q.reject("No owner specified for this vehicle.");
      }
    
      // Declare vehicleId in the outer scope.
      let vehicleId;
    
      return saveImages(files)
        .then(function(imageUrls) {
          vehicleId = crypto.randomUUID();
          const vehicle = {
            vehicle_id: vehicleId,
            vehicleModel: carData.vehicleModel,
            vehicleNumber: carData.vehicleNumber,
            vehicle_owner_id: carData.vehicle_owner_id,
            owner: carData.owner,
            images_URL: imageUrls,
            pricing: {
              basePrice: Number(carData.basePrice) || 0,
              basePriceOutstation: Number(carData.basePriceOutstation) || 0
            },
            superCategory: carData.superCategory,
            category: carData.category,
            features: carData.features,
            location: carData.location,
            availability: "Available",
            created_at: new Date().toISOString()
          };
          return DbService.addRecord('vehicles', vehicle);
        })
        .then(function() {
          return getVehicleById(vehicleId);
        });
    }
    
    function getVehicleById(vehicleId) {
      return DbService.getRecord('vehicles', vehicleId)
        .then(function(vehicle) {
          if (!vehicle) throw new Error("Vehicle not found after creation.");
          return vehicle;
        });
    }

    function saveImages(files) {
      if (!files || !files.length) {
        return Promise.resolve([]);
      }
      const promises = [];
      for (let i = 0; i < files.length; i++) {
        promises.push(convertFileToBase64(files[i]));
      }
      return Promise.all(promises);
    }

    function convertFileToBase64(file) {
      return new Promise(function(resolve, reject) {
        if (file.size > 5 * 1024 * 1024) {
          return reject("File too large, must be under 5MB.");
        }
        let reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        reader.onerror = function(err) {
          reject(err);
        };
        reader.readAsDataURL(file);
      });
    }

    function loadSuperCategories() {
      return DbService.getStore("superCategories", "readonly")
        .then(function(store) {
          return new Promise(function(resolve, reject) {
            const req = store.getAll();
            req.onsuccess = function(e) {
              resolve(e.target.result || []);
            };
            req.onerror = function() {
              reject(req.error);
            };
          });
        });
    }

    function loadCategories(superCategoryId) {
      return DbService.getStore("categories", "readonly")
        .then(function(store) {
          const index = store.index("supercategory_id");
          return new Promise(function(resolve, reject) {
            const req = index.getAll(superCategoryId);
            req.onsuccess = function(e) {
              let cats = e.target.result || [];
              cats.push({ category_id: "Other", category_name: "Other" });
              resolve(cats);
            };
            req.onerror = function() {
              reject(req.error);
            };
          });
        });
    }

    function saveNewSuperCategory(name) {
      const supercategoryId = crypto.randomUUID();
      const record = {
        supercategory_id: supercategoryId,
        superCategory_name: name
      };
      return DbService.addRecord('superCategories', record)
        .then(function() {
          return supercategoryId;
        });
    }

    function saveNewCategory(catName, superCatId) {
      const categoryId = crypto.randomUUID();
      const record = {
        category_id: categoryId,
        category_name: catName,
        supercategory_id: superCatId
      };
      return DbService.addRecord('categories', record)
        .then(function() {
          return categoryId;
        });
    }

    function getSuperCategoryByName(name) {
      // Placeholder – extend with an actual DB query if needed.
      return Promise.resolve(null);
    }

    function getCategoryByName(name, superCatId) {
      // Placeholder – extend with an actual DB query if needed.
      return Promise.resolve(null);
    }

    /**
     * Loads bids for the current seller with optional status filtering
     * @param {string} status - Filter bids by this status if provided
     * @returns {Promise} Promise resolving to an array of bids
     */
    function loadBids(status) {
      console.log('[SellerListingsService] Loading bids with status:', status);
      const seller = AuthService.getLoggedInUser();
      
      if (!seller) {
        console.error('No seller logged in');
        return $q.when([]);
      }

      return DbService.getStore('bidding', 'readonly')
        .then((store) => {
          return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = (event) => {
              const allBids = event.target.result || [];
              console.log('[SellerListingsService] Total bids found:', allBids.length);
              
              // Filter bids for this seller
              const sellerBids = allBids.filter(bid => 
                bid.seller && String(bid.seller.user_id) === String(seller.user_id)
              );
              
              // Apply status filter if provided
              const filteredBids = status ? 
                sellerBids.filter(bid => 
                  String(bid.bid_status).toLowerCase() === String(status).toLowerCase()
                ) : 
                sellerBids;
              
              console.log('[SellerListingsService] Filtered bids:', filteredBids.length);
              resolve(filteredBids);
            };
            request.onerror = (event) => {
              console.error('[SellerListingsService] Error loading bids:', event.target.error);
              reject(event.target.error);
            };
          });
        })
        .catch(error => {
          console.error('[SellerListingsService] Failed to load bids:', error);
          return [];
        });
    }

    /**
     * Auto-rejects bids that overlap with an accepted bid's timeframe
     * @param {Object} acceptedBid - The bid that was accepted
     * @returns {Promise} Promise resolving when all overlapping bids are rejected
     */
    function autoRejectOverlappingBids(acceptedBid) {
      return DbService.getStore('bidding', 'readwrite')
        .then(store => {
          return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = event => {
              const bids = event.target.result;
              const overlappingBids = bids.filter(bid => 
                bid.bid_id !== acceptedBid.bid_id &&
                bid.bid_status === 'Active' &&
                bid.vehicle &&
                bid.vehicle.vehicle_id === acceptedBid.vehicle.vehicle_id &&
                isOverlap(
                  acceptedBid.booking_start_date,
                  acceptedBid.booking_end_date,
                  bid.booking_start_date,
                  bid.booking_end_date
                )
              );
              
              const updatePromises = overlappingBids.map(bid => {
                bid.bid_status = 'Rejected';
                return DbService.updateRecord('bidding', bid);
              });
              
              Promise.all(updatePromises)
                .then(resolve)
                .catch(reject);
            };
            
            request.onerror = event => reject(event.target.error);
          });
        });
    }

    /**
     * Checks if two date ranges overlap
     * @param {string} start1 - Start date of first range
     * @param {string} end1 - End date of first range
     * @param {string} start2 - Start date of second range
     * @param {string} end2 - End date of second range
     * @returns {boolean} True if the ranges overlap
     */
    function isOverlap(start1, end1, start2, end2) {
      // Implement date overlap checking logic here
      const s1 = new Date(start1).getTime();
      const e1 = new Date(end1).getTime();
      const s2 = new Date(start2).getTime();
      const e2 = new Date(end2).getTime();
      
      return (s1 <= e2 && s2 <= e1);
    }
  }
