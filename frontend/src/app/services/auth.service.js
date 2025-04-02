/**
 * Authentication Service
 * Handles user authentication, registration, and profile management
 * Provides methods for signing up, logging in, getting current user, and logging out
 */
"use strict";

angular.module("carRentalApp").service("AuthService", AuthService);

/**
 * Service dependencies
 */
AuthService.$inject = ["$http", "$q", "AppConfig", "$rootScope", "$state", "ValidationService"];

/**
 * Authentication service implementation
 * 
 * @param {Object} $http - Angular HTTP service for API calls
 * @param {Object} $q - Angular Promise service
 * @param {Object} AppConfig - Application configuration constants
 * @param {Object} $rootScope - Angular root scope for application-wide events
 * @param {Object} $state - UI Router state service for navigation
 * @param {Object} ValidationService - Service for input validation
 */
function AuthService($http, $q, AppConfig, $rootScope, $state, ValidationService) {
  /**
   * Authentication API endpoint
   */
  const API_ENDPOINT = "/api/v1/auth";
  
  /**
   * Default profile image URL for new users
   */
  const DEFAULT_PHOTO_URL =
    "https://photosking.net/wp-content/uploads/2024/05/no-dp-pic_23.webp";

  // Cache the current user data to avoid frequent API calls
  let currentUserCache = null;

  const service = this;

  // Public service methods
  service.signUpBuyer = signUpBuyer;
  service.signUpSeller = signUpSeller;
  service.loginUser = loginUser;
  service.getLoggedInUser = getLoggedInUser;
  service.getCurrentUser = getCurrentUser;
  service.logoutUser = logoutUser;
  service.logout = logoutUser; // Alias for consistency

  // ===== User Authentication Methods =====

  /**
   * Register a new buyer account
   * @param {string} email - User's email address
   * @param {string} username - User's display name
   * @param {string} phone - User's phone number
   * @param {string} password - User's password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise} Promise resolving to the created user object
   */
  function signUpBuyer(email, username, phone, password, confirmPassword) {
    return $q(function (resolve, reject) {
      // Validate inputs
      if (!ValidationService.isValidEmail(email)) {
        return reject("Invalid email format!");
      }
      if (!ValidationService.isValidUsername(username)) {
        return reject(
          "Username must be 3-20 characters (letters, numbers, underscores)."
        );
      }
      if (!ValidationService.isValidPassword(password)) {
        return reject(
          "Password must be >=6 chars, 1 uppercase, 1 number, 1 special character."
        );
      }
      if (!ValidationService.passwordsMatch(password, confirmPassword)) {
        return reject("Passwords do not match!");
      }

      // Prepare data for API call
      const userData = {
        email: email,
        password: password,
        name: username,
        phone: phone,
      };

      // Call the backend API
      $http
        .post(AppConfig.apiBaseUrl + API_ENDPOINT + "/register", userData, {
          withCredentials: true,
        })
        .then(function (response) {
          if (response.data && response.data.data && response.data.data.user) {
            const user = formatUserData(response.data.data);

            // Update the cache
            currentUserCache = user;

            // Set user role in rootScope for immediate access
            $rootScope.userRole = user.user_role;

            // Notify the application that a user has logged in
            $rootScope.$broadcast("auth:userLoggedIn", user);

            // Handle redirection based on user role
            if (user.user_role.includes("seller")) {
              $state.go("sellerDashboard");
            } else if (user.user_role.includes("user")) {
              $state.go("buyerHome");
            } else if (user.user_role.includes("admin")) {
              $state.go("superAdmin");
            } else {
              $state.go("landingPage");
            }

            resolve(user);
          } else {
            reject("Invalid response from server");
          }
        })
        .catch(function (error) {
          reject(error.data ? error.data.message : "Registration failed");
        });
    });
  }

  /**
   * Register a new seller account or upgrade existing user to seller role
   * @param {Object} sellerData - All seller details
   * @returns {Promise} Promise resolving to the created/updated seller object
   */
  function signUpSeller(
    email,
    businessName,
    phone,
    password,
    confirmPassword,
    line1,
    line2,
    city,
    state,
    pincode
  ) {
    return $q(function (resolve, reject) {
      // Validate all required inputs
      if (
        !email ||
        !businessName ||
        !password ||
        !confirmPassword ||
        !line1 ||
        !city ||
        !state ||
        !pincode
      ) {
        return reject("All fields are required!");
      }
      if (!ValidationService.isValidEmail(email)) {
        return reject("Invalid email format!");
      }
      if (!isValidBusinessName(businessName)) {
        return reject("Business name must be >= 3 characters.");
      }
      if (!ValidationService.isValidPassword(password)) {
        return reject(
          "Password must be >=6 chars, 1 uppercase, 1 number, 1 special character."
        );
      }
      if (!ValidationService.passwordsMatch(password, confirmPassword)) {
        return reject("Passwords do not match!");
      }

      // First check if user is already logged in by making a lightweight API call
      getCurrentUser()
        .then(function (user) {
          // User is logged in, upgrade to seller
          const addressData = {
            address: {
              street: line1,
              city: city,
              state: state,
              country: "India", // Default to India
              postal_code: pincode,
            },
            phone: phone,
          };

          // Call API to become a seller
          return $http.patch(
            AppConfig.apiBaseUrl + API_ENDPOINT + "/become-seller",
            addressData,
            { withCredentials: true }
          );
        })
        .catch(function () {
          // User is not logged in, register as new seller
          const userData = {
            email: email,
            password: password,
            name: businessName,
            phone: phone,
            role: "seller",
            address: {
              street: line1,
              city: city,
              state: state,
              country: "India", // Default to India
              postal_code: pincode,
            },
          };

          // Call API to register
          return $http.post(
            AppConfig.apiBaseUrl + API_ENDPOINT + "/register",
            userData,
            { withCredentials: true }
          );
        })
        .then(function (response) {
          if (response.data && response.data.data && response.data.data.user) {
            const user = formatUserData(response.data.data);

            // Add address-specific properties
            if (user.address) {
              user.address.line1 = user.address.street;
              user.address.line2 = line2;
              user.address.pincode = user.address.postal_code;
            }

            // Update the cache
            currentUserCache = user;

            // Set user role in rootScope for immediate access
            $rootScope.userRole = user.user_role;

            // Notify the application that a user has logged in
            $rootScope.$broadcast("auth:userLoggedIn", user);

            // Handle redirection based on user role
            if (user.user_role.includes("seller")) {
              $state.go("sellerDashboard");
            } else if (user.user_role.includes("buyer")) {
              $state.go("buyerHome");
            } else if (user.user_role.includes("admin")) {
              $state.go("superAdmin");
            } else {
              $state.go("landingPage");
            }

            resolve(user);
          } else {
            reject("Invalid response from server");
          }
        })
        .catch(function (error) {
          reject(error.data ? error.data.message : "Seller operation failed");
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
    return $q(function (resolve, reject) {
      // Validate inputs
      if (!email || !password) {
        return reject("Email and password are required!");
      }

      const loginData = {
        email: email,
        password: password,
      };

      console.log("Attempting login with:", { email });

      // Call the backend API
      $http
        .post(AppConfig.apiBaseUrl + API_ENDPOINT + "/login", loginData, {
          withCredentials: true,
        })
        .then(function (response) {
          console.log("Login response:", response.data);

          if (response.data && response.data.data && response.data.data.user) {
            const user = formatUserData(response.data.data);
            console.log("Formatted user data:", user);

            // Update the cache
            currentUserCache = user;
            
            // Save to localStorage
            try {
              localStorage.setItem('currentUser', JSON.stringify(user));
            } catch (e) {
              console.error("Error saving user to localStorage:", e);
            }

            // Store additional user info in rootScope
            $rootScope.currentUser = user;
            $rootScope.userId = user._id;
            $rootScope.userName = user.name;
            $rootScope.userEmail = user.email;
            $rootScope.token = response.data.data.token;
            sessionStorage.setItem(
              "auth_token",
              response.data.data.token
            );
            // Notify the application that a user has logged in
            $rootScope.$broadcast("auth:userLoggedIn", user);

            // Handle redirection based on user role
            const userRoles = user.user_role || [];
            console.log("User roles for redirection:", userRoles);

            try {
              if (userRoles.includes("seller")) {
                console.log("Redirecting to seller dashboard");
                $state.go("sellerDashboard");
              } else if (
                userRoles.includes("buyer") ||
                userRoles.includes("user")
              ) {
                console.log("Redirecting to buyer home");
                $state.go("buyerHome");
              } else if (userRoles.includes("admin")) {
                console.log("Redirecting to admin dashboard");
                $state.go("superAdmin");
              } else {
                console.log(
                  "No specific role found, redirecting to landing page"
                );
                $state.go("landingPage");
              }
            } catch (error) {
              console.error("Error during state transition:", error);
              $state.go("landingPage");
            }

            resolve(user);
          } else {
            console.error("Invalid response format:", response.data);
            reject("Invalid response from server");
          }
        })
        .catch(function (error) {
          console.error("Login error:", error);
          reject(error.data ? error.data.message : "Login failed");
        });
    });
  }

  /**
   * Retrieves the currently logged-in user's data.
   * Priority: Cache -> localStorage -> /me API endpoint.
   * Returns a promise resolving to the user object or null.
   */
  function getLoggedInUser() {
    // 1. Check Cache
    if (currentUserCache && currentUserCache._id) {
      console.log('[AuthService.getLoggedInUser] Returning cached user:', currentUserCache._id);
      return $q.resolve(currentUserCache);
    }

    // 2. Check localStorage
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser._id) {
          console.log('[AuthService.getLoggedInUser] Returning user from localStorage:', parsedUser._id);
          currentUserCache = parsedUser; // Restore cache
          return $q.resolve(parsedUser);
        } else {
          console.warn('[AuthService.getLoggedInUser] Invalid user data in localStorage, removing.');
          localStorage.removeItem('currentUser'); // Clean up invalid data
        }
      }
    } catch (e) {
      console.error('[AuthService.getLoggedInUser] Error reading localStorage:', e);
      localStorage.removeItem('currentUser'); // Clean up corrupted data
    }

    // 3. Check /me endpoint as last resort
    console.log('[AuthService.getLoggedInUser] No valid user in cache/localStorage, calling /me endpoint...');
    return $http({
        method: 'GET',
        url: AppConfig.apiBaseUrl + API_ENDPOINT + "/me",
        withCredentials: true,
        timeout: 5000, // Slightly longer timeout
      })
      .then(function (response) {
        if (response.data && response.data.data && response.data.data.user) {
          const user = formatUserData(response.data.data);
          if (user && user._id) { // Double-check formatted user
             console.log('[AuthService.getLoggedInUser] /me endpoint returned valid user:', user._id);
             currentUserCache = user; // Update cache
             try {
               localStorage.setItem('currentUser', JSON.stringify(user)); // Update localStorage
             } catch (e) {
               console.error("[AuthService.getLoggedInUser] Error saving user to localStorage after /me:", e);
             }
             // Optionally update $rootScope here if needed elsewhere
             $rootScope.currentUser = user;
             $rootScope.userRole = user.user_role;
             return user;
          } else {
             console.warn('[AuthService.getLoggedInUser] /me endpoint response formatted to invalid user.');
          }
        } else {
           console.warn('[AuthService.getLoggedInUser] /me endpoint did not return valid user structure:', response.data);
        }
        
        // If we reach here, /me check failed or returned invalid data
        currentUserCache = null;
        localStorage.removeItem('currentUser');
        return null; // Resolve with null
      })
      .catch(function (error) {
        console.error('[AuthService.getLoggedInUser] Error calling /me endpoint:', error.status, error.statusText);
        // Clear cache and localStorage on ANY error from /me
        currentUserCache = null;
        localStorage.removeItem('currentUser');
        return $q.resolve(null); // IMPORTANT: Resolve with null, don't reject here
      });
  }

  /**
   * Fetch the current user's information from the backend (/me endpoint)
   * Primarily used for explicit checks or profile updates, not general auth checks.
   * @returns {Promise} Promise resolving to the current user or rejecting if not logged in
   */
  function getCurrentUser() {
    return $q(function (resolve, reject) {
      $http
        .get(AppConfig.apiBaseUrl + API_ENDPOINT + "/me", {
          withCredentials: true,
        })
        .then(function (response) {
          if (response.data && response.data.data && response.data.data.user) {
            const user = formatUserData(response.data.data);
            currentUserCache = user;
            
            // Save to localStorage
            try {
              if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
              } else {
                // If /me returns no user, ensure localStorage is cleared
                localStorage.removeItem('currentUser');
              }
            } catch (e) {
              console.error("Error updating localStorage from getCurrentUser:", e);
            }
            
            // Set user role in rootScope for immediate access
            $rootScope.userRole = user.user_role;

            resolve(user);
          } else {
            // Clear the cache if we get an invalid response
            currentUserCache = null;
            $rootScope.userRole = null;
            reject("Invalid response from server");
          }
        })
        .catch(function (error) {
          // Clear the cache on errors
          currentUserCache = null;
          $rootScope.userRole = null;
          reject(error.data ? error.data.message : "Not authenticated");
        });
    });
  }

  /**
   * Log out the current user
   * @returns {Promise} Promise resolving when logout is complete
   */
  function logoutUser() {
    return $q(function (resolve, reject) {
      // Call the backend logout endpoint to clear the HTTP-only cookie
      $http
        .post(
          AppConfig.apiBaseUrl + API_ENDPOINT + "/logout",
          {},
          { withCredentials: true }
        )
        .then(function (response) {
          // Clear the cache
          currentUserCache = null;

          // Clear user role from rootScope
          $rootScope.userRole = null;

          // Notify the application that a user has logged out
          $rootScope.$broadcast("auth:userLoggedOut");

          // Redirect to landing page
          $state.go("landingPage");

          resolve(response.data);
        })
        .catch(function (error) {
          // Still clear the cache even if the server call fails
          currentUserCache = null;

          // Clear user role from rootScope
          $rootScope.userRole = null;

          // Notify logout
          $rootScope.$broadcast("auth:userLoggedOut");

          // Redirect to landing page even on failure
          $state.go("landingPage");

          reject(error.data ? error.data.message : "Logout failed");
        });
    });
  }

  /**
   * Format user data consistently for frontend use
   * @param {Object} user - Raw user data from API
   * @returns {Object} Formatted user data
   */
  function formatUserData(data) {
    console.log("Raw user data from API:", data);
    const user = data.user;

    if (!user) {
      return null;
    }

    // Determine user roles - handle both single role and array of roles
    let userRole = user.role;
    console.log("Initial userRole:", userRole);

    if (!userRole) {
      // If no role in user object, try to determine from user type
      if (user.isSeller) {
        userRole = "seller";
      } else if (user.isBuyer) {
        userRole = "buyer";
      } else if (user.isAdmin) {
        userRole = "admin";
      } else {
        userRole = "buyer"; // Default to buyer if no role specified
      }
      console.log("Determined userRole from user type:", userRole);
    }

    // Ensure userRole is always an array
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    console.log("Final userRoles array:", userRoles);

    // Save user role in rootScope for faster access across the app
    $rootScope.userRole = userRoles;

    return {
      _id: user._id,
      user_id: user._id,
      name: user.name || "",
      first_name: user.first_name || user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      profile_picture: user.profile_picture || DEFAULT_PHOTO_URL,
      user_role: userRoles,
      role: userRole, // Keep original role for backward compatibility
      token: data.token || "",
      address: user.address || {},
    };
  }

  /**
   * Validate business name
   * @param {string} businessName - Business name to validate
   * @returns {boolean} True if business name is valid
   */
  function isValidBusinessName(businessName) {
    return businessName && businessName.length >= 3;
  }
}
