// src/app/core/services/db.service.js
"use strict";

angular.module("carRentalApp").service("DbService", DbService);

DbService.$inject = ["$q", "$http", "AppConfig"];

function DbService($q, $http, AppConfig) {
  // Services methods and properties
  const service = this;
  const API_BASE = AppConfig.apiBaseUrl + '/api/v1';
  
  // Expose API methods
  service.addRecord = addRecord;
  service.getRecord = getRecord;
  service.updateRecord = updateRecord;
  service.deleteRecord = deleteRecord;
  service.getAllRecords = getAllRecords;
  service.getStore = getStore;
  service.getIndex = getIndex;
  
  // Initialize DbService as always ready
  const dbReady = $q.defer();
  service.isReady = dbReady.promise;
  dbReady.resolve(); // Always resolve immediately - no health check needed

  /**
   * Gets the appropriate endpoint URL for a store
   * @param {string} storeName - Store name
   * @returns {string} API endpoint URL
   */
  function getEndpoint(storeName) {
    const API_BASE_URL = 'http://localhost:5050/api/v1';
    
    // Map store names to API endpoints
    const endpointMap = {
      'users': '/users',
      'vehicles': '/vehicles',
      'bookings': '/bookings/seller',
      'bidding': '/bids',
      'conversations': '/messages/conversations',
      'messages': '/messages'
    };
    
    const endpoint = endpointMap[storeName];
    if (!endpoint) {
      console.warn(`No endpoint defined for store: ${storeName}`);
      return `${API_BASE_URL}/${storeName}`;
    }
    
    return `${API_BASE_URL}${endpoint}`;
  }

  /**
   * Get primary key field name for a store
   * @param {string} storeName - Name of the store
   * @returns {string} Key field name
   */
  function getKeyField(storeName) {
    const keyFields = {
      'users': '_id',
      'vehicles': '_id',
      'bookings': '_id',
      'bidding': '_id',
      'conversations': '_id',
      'messages': '_id'
    };
    
    return keyFields[storeName] || '_id';
  }

  /**
   * Gets a reference to a data store (for compatibility with old code)
   * @param {string} storeName - Name of the store
   * @param {string} mode - Access mode (ignored, kept for compatibility)
   * @returns {Promise} Promise that resolves with a store-like object
   */
  function getStore(storeName, mode) {
    console.log("Getting store (MongoDB):", storeName);
    
    // Return a store-like object that works with existing code
    return service.isReady.then(function() {
      return {
        // Placeholder to maintain compatibility with IndexedDB code
        // Real operations happen in the main service methods
        name: storeName,
        get: function(key) {
          return service.getRecord(storeName, key);
        },
        add: function(record) {
          return service.addRecord(storeName, record);
        },
        put: function(record) {
          return service.updateRecord(storeName, record);
        },
        delete: function(key) {
          return service.deleteRecord(storeName, key);
        },
        getAll: function() {
          return service.getAllRecords(storeName);
        }
      };
    });
  }

  /**
   * Gets an index from a store (for compatibility with old code)
   * This is a compatibility layer since MongoDB handles indexing differently
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name 
   * @param {string} mode - Access mode (ignored)
   * @returns {Promise} Promise resolving with index-like object
   */
  function getIndex(storeName, indexName, mode) {
    console.log("Getting index (MongoDB):", indexName, "for store:", storeName);
    
    return service.isReady.then(function() {
      return {
        // This object simulates an IndexedDB index with MongoDB filtering
        name: indexName,
        storeName: storeName,
        // Provide methods that match the IndexedDB API but use HTTP requests
        getAll: function(query) {
          const params = {};
          
          if (query) {
            params[indexName] = query;
          }
          
          return $http.get(getEndpoint(storeName), { 
            params: params,
            withCredentials: true 
          })
          .then(function(response) {
            return response.data.data || [];
          })
          .catch(function(error) {
            console.error(`Error in index.getAll for ${storeName} with index ${indexName}:`, error);
            // Return empty array on error to prevent breaking the UI
            return [];
          });
        }
      };
    });
  }

  /**
   * Adds a new record to the specified store
   * @param {string} storeName - Target store name
   * @param {Object} record - Data to be stored
   * @returns {Promise} Promise that resolves with the stored record
   */
  function addRecord(storeName, record) {
    console.log(`Adding record to ${storeName}:`, record);
    
    return $http.post(getEndpoint(storeName), record, { withCredentials: true })
      .then(function(response) {
        return response.data.data;
      })
      .catch(function(error) {
        console.error(`Error adding record to ${storeName}:`, error);
        return $q.reject(error.data?.message || `Failed to add record to ${storeName}`);
      });
  }

  /**
   * Gets a record by ID from the specified store
   * @param {string} storeName - Store name
   * @param {string} key - Record ID to retrieve
   * @returns {Promise} Promise resolving with the record
   */
  function getRecord(storeName, key) {
    console.log(`Getting record from ${storeName} with key:`, key);
    
    return $http.get(`${getEndpoint(storeName)}/${key}`, { withCredentials: true })
      .then(function(response) {
        return response.data.data;
      })
      .catch(function(error) {
        console.error(`Error getting record from ${storeName} with key ${key}:`, error);
        return $q.reject(error.data?.message || `Failed to get record from ${storeName}`);
      });
  }

  /**
   * Updates a record in the specified store
   * @param {string} storeName - Store name
   * @param {Object} record - Updated record data
   * @returns {Promise} Promise resolving with updated record
   */
  function updateRecord(storeName, record) {
    const keyField = getKeyField(storeName);
    const recordId = record[keyField] || record._id;
    
    console.log(`Updating record in ${storeName} with ID:`, recordId);
    
    if (!recordId) {
      return $q.reject('Record ID is missing');
    }
    
    return $http.put(`${getEndpoint(storeName)}/${recordId}`, record, { withCredentials: true })
      .then(function(response) {
        return response.data.data;
      })
      .catch(function(error) {
        console.error(`Error updating record in ${storeName} with ID ${recordId}:`, error);
        return $q.reject(error.data?.message || `Failed to update record in ${storeName}`);
      });
  }

  /**
   * Deletes a record from the specified store
   * @param {string} storeName - Store name
   * @param {string} key - ID of record to delete
   * @returns {Promise} Promise resolving when deletion is complete
   */
  function deleteRecord(storeName, key) {
    console.log(`Deleting record from ${storeName} with key:`, key);
    
    return $http.delete(`${getEndpoint(storeName)}/${key}`, { withCredentials: true })
      .then(function(response) {
        return response.data;
      })
      .catch(function(error) {
        console.error(`Error deleting record from ${storeName} with key ${key}:`, error);
        return $q.reject(error.data?.message || `Failed to delete record from ${storeName}`);
      });
  }

  /**
   * Gets all records from the specified store
   * @param {string} storeName - Store name
   * @returns {Promise} Promise resolving with all records
   */
  function getAllRecords(storeName) {
    console.log(`Getting all records from ${storeName}`);
    
    // Get authentication token from sessionStorage
    const token = sessionStorage.getItem('auth_token');
    
    return $http.get(getEndpoint(storeName), { 
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {},
      withCredentials: true 
    })
      .then(function(response) {
        return response.data.data || [];
      })
      .catch(function(error) {
        console.error(`Error getting all records from ${storeName}:`, error);
        // Return empty array instead of rejecting for better compatibility with existing code
        return [];
      });
  }
}
