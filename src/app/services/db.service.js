// src/app/core/services/db.service.js
"use strict";

angular.module("carRentalApp").service("DbService", DbService);

DbService.$inject = ["$q"];

function DbService($q) {
  // Services methods and properties
  const service = this;

  // Database configuration and state variables
  const DB_NAME = "CarRentalDB";
  const DB_VERSION = 7;
  let db;
  const  users = [];
  const addresses = [];
  const categories = [];
  const superCategories = [];
  const vehicles = [];
  const bookings = [];
  const conversations = [];
  const messages = [];
  const bidding = [];
  // const schema = {
  //   users: {},
  //   addresses: {},
  //   categories: {},
  //   superCategories: {},
  //   vehicles: {},
  //   bookings: {},
  //   conversations: {},
  //   messages: {},
  // };
  const dbReady = $q.defer();
  service.openDB = openDB;
  service.addRecord = addRecord;
  service.getRecord = getRecord;
  service.updateRecord = updateRecord;
  service.deleteRecord = deleteRecord;
  service.getAllRecords = getAllRecords;
  service.getStore = getStore;
  service.getIndex = getIndex;
  service.isReady = dbReady.promise;

  // Initialize the database connection when service is created
  console.log("Initializing IndexedDB...");
  
  openDB()
    .then(function () {
      console.log("IndexedDB initialized successfully");
      dbReady.resolve();
    })
    .catch(function (error) {
      console.error("Failed to initialize IndexedDB:", error);
      dbReady.reject(error);
    });

  /**
   * Opens a connection to the IndexedDB database and sets up schema
   * @returns {Promise} Promise that resolves when the database is ready
   */


  function openDB() {
    const deferred = $q.defer();
    console.log("Opening IndexedDB...");

    if (db) {
      console.log("Database already open");
      deferred.resolve(db);
      return deferred.promise;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      console.log("Database upgrade needed, creating stores...");
      db = event.target.result;
      const oldVersion = event.oldVersion;
      const transaction = event.target.transaction;
      
      // Helper function to migrate store data
      const migrateStoreData = (storeName) => {
        if (db.objectStoreNames.contains(storeName)) {
          const store = transaction.objectStore(storeName);
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            console.log(`Migrating data from ${storeName}:`, getAllRequest.result);
            // Store data temporarily in the corresponding array
            switch(storeName) {
              case 'users':
                users.push(...getAllRequest.result);
                break;
              case 'addresses':
                addresses.push(...getAllRequest.result);
                break;
              case 'categories':
                categories.push(...getAllRequest.result);
                break;
              case 'superCategories':
                superCategories.push(...getAllRequest.result);
                break;
              case 'vehicles':
                vehicles.push(...getAllRequest.result);
                break;
              case 'bookings':
                bookings.push(...getAllRequest.result);
                break;
              case 'conversations':
                conversations.push(...getAllRequest.result);
                break;
              case 'messages':
                messages.push(...getAllRequest.result);
                break;
              case 'bidding':
                bidding.push(...getAllRequest.result);
                break;
            }
          };
        }
      };

      // Migrate existing data before creating new stores
      const storeNames = ['users', 'addresses', 'categories', 'superCategories', 
                         'vehicles', 'bookings', 'conversations', 'messages', 'bidding'];
      storeNames.forEach(migrateStoreData);

      // Create stores with new schema
      console.log("onupgradeneeded => Creating object stores if not present.");

      // USERS
      if (!db.objectStoreNames.contains("users")) {
      
        var usersStore = db.createObjectStore("users", { keyPath: "user_id" });
      
        usersStore.createIndex("address_id", "address_id", { unique: false });
      
        usersStore.createIndex("email", "email", { unique: true });
      
      }

      // ADDRESSES
      
      if (!db.objectStoreNames.contains("addresses")) {
      
        db.createObjectStore("addresses", { keyPath: "address_id" });
      
      }
      
      // CATEGORIES
      
      if (!db.objectStoreNames.contains("categories")) {
      
        var catStore = db.createObjectStore("categories", {
      
          keyPath: "category_id",
      
        });
      
        catStore.createIndex("supercategory_id", "supercategory_id", {
      
          unique: false,
      
        });
      
      }
      
      // SUPER CATEGORIES
      
      if (!db.objectStoreNames.contains("superCategories")) {
      
        db.createObjectStore("superCategories", {
      
          keyPath: "supercategory_id",
      
        });
      
      }
      
      // VEHICLES
      
      if (!db.objectStoreNames.contains("vehicles")) {
      
        var vehiclesStore = db.createObjectStore("vehicles", {
      
          keyPath: "vehicle_id",
      
        });
      
        vehiclesStore.createIndex("vehicle_owner_id", "vehicle_owner_id", {
      
          unique: false,
      
        });
      
        vehiclesStore.createIndex("category_id", "category_id", {
      
          unique: false,
      
        });
      
        vehiclesStore.createIndex("location", "location", { unique: false });
      
      }
      
      // BOOKINGS
      
      if (!db.objectStoreNames.contains("bookings")) {
      
        var bookingsStore = db.createObjectStore("bookings", {
      
          keyPath: "booking_id",
      
        });

        bookingsStore.createIndex("vehicle_id", "vehicle_id", {
      
          unique: false,
      
        });
      
        bookingsStore.createIndex("renter_id", "renter.user_id", {
      
          unique: false,
      
        });
      
        bookingsStore.createIndex("seller_id", "seller.user_id", {
      
          unique: false,
      
        });
      
        bookingsStore.createIndex("bid_id", "bid_id", { unique: false });
      
        bookingsStore.createIndex(
      
          "vehicle_dates",
      
          ["vehicle_id", "booking_start_date", "booking_end_date"],
      
          { unique: false }
      
        );
      
        bookingsStore.createIndex(
      
          "seller_status",
      
          ["seller.user_id", "status"],
      
          { unique: false }
      
        );
      
      }
      
      // CONVERSATIONS
      
      if (!db.objectStoreNames.contains("conversations")) {
      
        var convStore = db.createObjectStore("conversations", {
      
          keyPath: "conversation_id",
      
        });
      
        convStore.createIndex("sender_id", "sender_id", { unique: false });
      
        convStore.createIndex("receiver_id", "receiver_id", { unique: false });
      
        convStore.createIndex("vehicle_id", "vehicle_id", { unique: false });
      
      }
      
      // MESSAGES
      
      if (!db.objectStoreNames.contains("messages")) {
      
        var messagesStore = db.createObjectStore("messages", {
      
          keyPath: "message_id",
      
        });
      
        messagesStore.createIndex("conversation_id", "conversation_id", {
      
          unique: false,
      
        });
      
        messagesStore.createIndex("timestamp", "timestamp", { unique: false });
      
        messagesStore.createIndex("vehicle_id", "vehicle_id", {
      
          unique: false,
      
        });
      
      }
      
      // BIDDING
      
      if (!db.objectStoreNames.contains("bidding")) {
      
        var biddingStore = db.createObjectStore("bidding", {
      
          keyPath: "bid_id",
      
        });
      
        biddingStore.createIndex("vehicle_id", "vehicle_id", { unique: false });
      
        biddingStore.createIndex("bidder_id", "bidder.user_id", {
      
          unique: false,
      
        });
      
        biddingStore.createIndex("seller_id", "seller.user_id", {
      
          unique: false,
      
        });
      
        biddingStore.createIndex("bid_date", "bid_date", { unique: false });
      
        biddingStore.createIndex(
      
          "seller_status",
      
          ["seller.user_id", "bid_status"],
      
          { unique: false }
      
        );
      
        biddingStore.createIndex(
      
          "vehicle_status",
      
          ["vehicle_id", "bid_status"],
      
          { unique: false }
      
        );
      
        biddingStore.createIndex(
      
          "vehicle_dates",
      
          ["vehicle_id", "booking_start_date", "booking_end_date"],
      
          { unique: false }
      
        );
      
      }

      // After stores are created, restore migrated data
      transaction.oncomplete = () => {
        const restoreData = (storeName, data) => {
          if (data.length > 0) {
            const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
            data.forEach(item => store.add(item));
          }
        };

        restoreData('users', users);
        restoreData('addresses', addresses);
        restoreData('categories', categories);
        restoreData('superCategories', superCategories);
        restoreData('vehicles', vehicles);
        restoreData('bookings', bookings);
        restoreData('conversations', conversations);
        restoreData('messages', messages);
        restoreData('bidding', bidding);

        // Clear temporary arrays
        users.length = 0;
        addresses.length = 0;
        categories.length = 0;
        superCategories.length = 0;
        vehicles.length = 0;
        bookings.length = 0;
        conversations.length = 0;
        messages.length = 0;
        bidding.length = 0;
      };
    };



    
    request.onsuccess = function (event) {
      db = event.target.result;
    
      console.log("Database opened successfully");
    
      deferred.resolve(db);
    
    };

    
    request.onerror = function (event) {
    
      console.error("Error opening database:", event.target.error);
    
      deferred.reject(event.target.error);
    
    };

    return deferred.promise;
  }

  /**
   * Gets an object store from the database
   * @param {string} storeName - Name of the store to retrieve
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @returns {Promise} Promise that resolves with the requested store
   */

  function getStore(storeName, mode) {

    return service.isReady.then(function () {

      console.log("Getting store:", storeName, "mode:", mode);

      const transaction = db.transaction([storeName], mode);

      return transaction.objectStore(storeName);

    });

  }
  /**
   * Gets an index from a specified object store
   * @param {string} storeName - Name of the store containing the index
   * @param {string} indexName - Name of the index to retrieve
   * @param {string} mode - Transaction mode
   * @returns {Promise} Promise that resolves with the requested index
   */

  function getIndex(storeName, indexName, mode) {

    console.log("Getting index:", indexName, "for store:", storeName);

    return getStore(storeName, mode).then(function (store) {

      const index = store.index(indexName);

      return index;

    });
  }
  /**
   * Adds a new record to the specified store
   * @param {string} storeName - Target store name
   * @param {Object} record - Data to be stored
   * @returns {Promise} Promise that resolves with the stored record
   */

  function addRecord(storeName, record) {

    const deferred = $q.defer();

    getStore(storeName, "readwrite").then(function (store) {

      const request = store.add(record);

      request.onsuccess = function () {

        deferred.resolve(record);

      };

      request.onerror = function (e) {

        deferred.reject(e.target.error);

      };

    });

    return deferred.promise;

  }


  
  function getRecord(storeName, key) {
  
    var deferred = $q.defer();
  
    getStore(storeName, "readonly").then(function (store) {
  
      var request = store.get(key);
  
      request.onsuccess = function (e) {
  
        deferred.resolve(e.target.result);
  
      };
  
      request.onerror = function (e) {
  
        deferred.reject(e.target.error);
  
      };
  
    });
  
    return deferred.promise;
  
  }


  
  function updateRecord(storeName, record) {
  
    var deferred = $q.defer();
  
    getStore(storeName, "readwrite").then(function (store) {
  
      var request = store.put(record);
  
      request.onsuccess = function () {
  
        deferred.resolve(record);
  
      };
  
      request.onerror = function (e) {
  
        deferred.reject(e.target.error);
  
      };
  
    });
  
    return deferred.promise;
  
  }


  
  function deleteRecord(storeName, key) {
  
    var deferred = $q.defer();
  
    getStore(storeName, "readwrite").then(function (store) {
  
      var request = store.delete(key);
  
      request.onsuccess = function () {
  
        deferred.resolve();
  
      };
  
      request.onerror = function (e) {
  
        deferred.reject(e.target.error);
  
      };
  
    });
  
    return deferred.promise;
  
  }


  
  function getAllRecords(storeName) {
  
    var deferred = $q.defer();
  
    getStore(storeName, "readonly").then(function (store) {
  
      var request = store.getAll();
  
      request.onsuccess = function (e) {
  
        deferred.resolve(e.target.result);
  
      };
  
      request.onerror = function (e) {
  
        deferred.reject(e.target.error);
  
      };
  
    });
  
    return deferred.promise;
  
  }
}
