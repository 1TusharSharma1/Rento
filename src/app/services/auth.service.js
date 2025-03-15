// src/app/core/services/auth.service.js
'use strict';

angular
  .module('carRentalApp')
  .service('AuthService', AuthService);

AuthService.$inject = ['DbService', '$window', '$q'];

function AuthService(DbService, $window, $q) {

  const DEFAULT_PHOTO_URL = 'https://photosking.net/wp-content/uploads/2024/05/no-dp-pic_23.webp';
  const service = this;


  service.signUpBuyer = signUpBuyer;
  service.signUpSeller = signUpSeller;
  service.loginUser = loginUser;
  service.getLoggedInUser = getLoggedInUser;
  service.logoutUser = logoutUser;
  service.isLoggedInAs = isLoggedInAs;

  // ===== User Authentication Methods =====

  /**
   * Register a new buyer account
   * @param {string} email - User's email address
   * @param {string} username - User's display name
   * @param {string} password - User's password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise} Promise resolving to the created user object
   */
  function signUpBuyer(email, username, password, confirmPassword) {
    return $q(function(resolve, reject) {
      // Validate inputs
      if (!isValidEmail(email)) {
        return reject('Invalid email format!');
      }
      if (!isValidUsername(username)) {
        return reject('Username must be 3-20 characters (letters, numbers, underscores).');
      }
      if (!isValidPassword(password)) {
        return reject('Password must be >=6 chars, 1 uppercase, 1 number, 1 special character.');
      }
      if (!passwordsMatch(password, confirmPassword)) {
        return reject('Passwords do not match!');
      }
      
      DbService.getStore('users', 'readwrite')
        .then(function(store) {
          const emailIndex = store.index('email');
          const getRequest = emailIndex.get(email);
  
          getRequest.onsuccess = function(e) {
            const existingUser = e.target.result;
            if (existingUser) {
              return reject('Email already registered!');
            }
  
            const userId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
              ? crypto.randomUUID() 
              : generateUUID();
            const newUser = {
                user_id: userId,
                email: email,
                first_name: username,
                password: hashPassword(password),
                photoURL: DEFAULT_PHOTO_URL,
                user_role: ['buyer'],
                created_at: new Date().toISOString(),
                address: {
                  line1: '',
                  line2: '',
                  city: '',
                  state: '',
                  pincode: null
                },
                activeBidCount: 0,
                activeBookingCount: 0
              };
              
  
            const addReq = store.add(newUser);
            addReq.onsuccess = function() {
              $window.sessionStorage.setItem('loggedInUser', JSON.stringify(newUser));
              resolve(newUser);
            };
            addReq.onerror = function(evt) {
              reject('Error adding user: ' + evt.target.error);
            };
          };
  
          getRequest.onerror = function(evt) {
            reject('Error fetching user by email: ' + evt.target.error);
          };
        })
        .catch(function(err) {
          reject(err);
        });
    });
  }
  
  /**
   * Register a new seller account or upgrade existing user to seller role
   * @param {string} email - Seller's email address
   * @param {string} businessName - Name of the business
   * @param {string} password - Seller's password
   * @param {string} confirmPassword - Password confirmation
   * @param {string} line1 - Address line 1
   * @param {string} line2 - Address line 2
   * @param {string} city - City
   * @param {string} state - State
   * @param {string} pincode - Postal code
   * @returns {Promise} Promise resolving to the created/updated seller object
   */
  function signUpSeller(email, businessName, password, confirmPassword,
                        line1, line2, city, state, pincode) {
    return $q(function(resolve, reject) {
      // Validate all required inputs
      if (!email || !businessName || !password || !confirmPassword || !line1 || !city || !state || !pincode) {
        return reject('All fields are required!');
      }
      if (!isValidEmail(email)) {
        return reject('Invalid email format!');
      }
      if (!isValidBusinessName(businessName)) {
        return reject('Business name must be >= 3 characters.');
      }
      if (!isValidPassword(password)) {
        return reject('Password must be >=6 chars, 1 uppercase, 1 number, 1 special character.');
      }
      if (!passwordsMatch(password, confirmPassword)) {
        return reject('Passwords do not match!');
      }

      DbService.getStore('users', 'readwrite')
        .then(function(store) {
          const emailIndex = store.index('email');
          const getReq = emailIndex.get(email);

          getReq.onsuccess = function(e) {
            const user = e.target.result;
            if (user) {
              // If user exists, check if already a seller
              if (user.user_role.includes('seller')) {
                return reject('You are already registered as a seller.');
              }

              // Upgrade existing user to seller
              user.user_role.push('seller');
              user.address_line1 = line1;
              user.address_line2 = line2;
              user.city = city;
              user.state = state;
              user.pincode = Number(pincode);

              const putReq = store.put(user);
              putReq.onsuccess = function() {
                $window.sessionStorage.setItem('loggedInUser', JSON.stringify(user));
                resolve(user);
              };
              putReq.onerror = function(evt) {
                reject('Error upgrading user to seller: ' + evt.target.error);
              };
            } else {
              // Create new seller
              const userId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
                ? crypto.randomUUID() 
                : generateUUID();
              const newSeller = {
                user_id: userId,
                email: email,
                first_name: businessName,
                last_name: '',
                password: hashPassword(password),
                photoURL: DEFAULT_PHOTO_URL,
                user_role: ['seller'],
                created_at: new Date().toISOString(),
                address: {
                  line1: line1,
                  line2: line2,
                  city: city,
                  state: state,
                  pincode: Number(pincode),
                  longitude: null,
                  latitude: null
                },
                isPending: true,
              };
              

              const addReq = store.add(newSeller);
              addReq.onsuccess = function() {
                $window.sessionStorage.setItem('loggedInUser', JSON.stringify(newSeller));
                resolve(newSeller);
              };
              addReq.onerror = function(evt) {
                reject('Error creating new seller: ' + evt.target.error);
              };
            }
          };

          getReq.onerror = function(evt) {
            reject('Error retrieving user by email: ' + evt.target.error);
          };
        })
        .catch(function(err) {
          reject(err);
        });
    });
  }

  /**
   * Authenticate a user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise} Promise resolving to the authenticated user object
   */
  function loginUser(email, password) {
    return $q(function(resolve, reject) {
      // Validate inputs
      if (!email || !password) {
        return reject('Email and password are required!');
      }

      DbService.getStore('users', 'readonly')
        .then(function(store) {
          const emailIndex = store.index('email');
          const request = emailIndex.get(email);

          request.onsuccess = function(e) {
            const user = e.target.result;
            if (!user) {
              return reject('User not found! Please sign up first.');
            }
            if (user.password !== hashPassword(password)) {
              return reject('Incorrect password!');
            }
            $window.sessionStorage.setItem('loggedInUser', JSON.stringify(user));
            resolve(user);
          };

          request.onerror = function(evt) {
            reject('Error fetching user: ' + evt.target.error);
          };
        })
        .catch(function(err) {
          reject(err);
        });
    });
  }

  /**
   * Gets the currently logged in user from session storage
   * @returns {Object|null} User object or null if not logged in
   */
  function getLoggedInUser() {
    const userJson = $window.sessionStorage.getItem('loggedInUser');
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Removes the user from session storage, effectively logging them out
   */
  function logoutUser() {
    $window.sessionStorage.removeItem('loggedInUser');
  }

  /**
   * Hashes a password using SHA-256
   * @param {string} password - Plain text password
   * @returns {string} Hashed password
   */
  function hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
  }

  /**
   * Checks if two passwords match
   * @param {string} pass1 - First password
   * @param {string} pass2 - Second password
   * @returns {boolean} True if passwords match
   */
  function passwordsMatch(pass1, pass2) {
    return pass1 === pass2;
  }

  /**
   * Validates email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Validates username format (3-20 characters, alphanumeric + underscore)
   * @param {string} username - Username to validate
   * @returns {boolean} True if valid username
   */
  function isValidUsername(username) {
    const re = /^[A-Za-z0-9_]{3,20}$/;
    return re.test(username);
  }

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @returns {boolean} True if password meets requirements
   */
  function isValidPassword(password) {
    const re = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
    return re.test(password);
  }

  /**
   * Validates business name length
   * @param {string} businessName - Business name to validate
   * @returns {boolean} True if valid business name
   */
  function isValidBusinessName(businessName) {
    return businessName.length >= 3;
  }
  
  /**
   * Checks if the current user has the specified role
   * @param {string} role - Role to check for
   * @returns {Promise} Promise resolving to user if they have the role
   */
  function isLoggedInAs(role) {
    return $q(function(resolve, reject) {
      const user = getLoggedInUser();
      
      if (!user) {
        reject('Not logged in');
        return;
      }
      
      const userRoles = Array.isArray(user.user_role) ? user.user_role : [user.user_role];
      
      if (userRoles.includes(role)) {
        resolve(user);
      } else {
        reject('User does not have the required role: ' + role);
      }
    });
  }
  
  /**
   * Generates a random UUID
   * @returns {string} Generated UUID
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}