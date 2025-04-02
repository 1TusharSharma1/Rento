/**
 * Angular routing configuration module for the Car Rental Application
 * Defines all application states and their corresponding views, controllers, and CSS dependencies
 */

"use strict";

angular.module("carRentalApp").config(configRoutes);

/**
 * Dependencies injection for the routing configuration
 * @param {Object} $stateProvider - For defining application states/routes
 * @param {Object} $urlRouterProvider - For handling unknown or default routes
 * @param {Object} $ocLazyLoadProvider - For lazy loading of CSS/JS resources
 * @param {Object} $locationProvider - For HTML5 mode URL configuration
 */
configRoutes.$inject = [
  "$stateProvider",
  "$urlRouterProvider",
  "$ocLazyLoadProvider",
  "$locationProvider",
];

/**
 * Main routing configuration function that sets up all application states
 * Configures HTML5 mode and lazy loading settings
 * Defines routes for:
 * - Landing page
 * - Authentication (login/signup)
 * - Buyer features (home, bookings, car details)
 * - Seller features (dashboard, listings, bookings)
 * - Messaging system
 * - User profile
 * - Admin features
 */
function configRoutes(
  $stateProvider,
  $urlRouterProvider,
  $ocLazyLoadProvider,
  $locationProvider
) {
  $locationProvider.html5Mode(true);

  $ocLazyLoadProvider.config({
    debug: false,
    events: true,
  });

  $urlRouterProvider.otherwise("/");
  $stateProvider
    .state("landingPage", {
      url: "/",
      templateUrl: "src/app/views/landingPage/landingPage.html",
      controller: "LandingPageController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/landingPage/landingPage.css",
            });
          },
        ],
      },
    })
    .state("login", {
      url: "/login",
      templateUrl: "src/app/views/auth/login/login.html",
      controller: "LoginController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/auth/login/login.css",
            });
          },
        ],
      },
    })
    .state("signup", {
      url: "/signup",
      templateUrl: "src/app/views/auth/signup/signup.html",
      controller: "SellerSignupController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/auth/signup/signup.css",
            });
          },
        ],
      },
    })
    .state("buyerHome", {
      url: "/buyerHome",
      templateUrl: "src/app/views/buyer/homePage/buyerHomePage.html",
      controller: "BuyerHomeController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load([
              {
                type: "css",
                path: "src/app/views/buyer/homePage/buyerHomePage.css",
              },
              {
                type: "css",
                path: "src/app/components/navbar/navbar.css",
              },
            ]);
          },
        ],
      },
    })
    .state("sellerDashboard", {
      url: "/sellerDashboard",
      templateUrl: "src/app/views/seller/dashboard/sellerDashboard.html",
      controller: "SellerDashboardController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/seller/dashboard/sellerDashboard.css",
            });
          },
        ],
      },
    })
    .state("sellerListings", {
      url: "/sellerListings",
      templateUrl: "src/app/views/seller/listings/sellerListings.html",
      controller: "SellerListingsController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/seller/listings/sellerListings.css",
            });
          },
        ],
      },
    })
    .state("sellerBookings", {
      url: "/sellerBookings",
      templateUrl: "src/app/views/seller/bookings/sellerBookings.html",
      controller: "SellerBookingsController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/seller/bookings/sellerBookings.css",
            });
          },
        ],
      },
    })
    .state("conversations", {
      url: "/conversations",
      templateUrl: "src/app/components/messaging/conversations.html",
      controller: "ConversationsController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/components/messaging/conversations.css",
            });
          },
        ],
      },
    })
    .state("chat", {
      url: "/chat?conversationId",
      templateUrl: "src/app/components/messaging/chat.html",
      controller: "ChatController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/components/messaging/conversations.css",
            });
          },
        ],
      },
    })
    .state("carDetails", {
      url: "/carDetails?carId",
      templateUrl: "src/app/views/buyer/carDetails/carDetails.html",
      controller: "CarDetailsController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load([
              {
                type: "css",
                path: "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css",
              },
              {
                type: "css",
                path: "src/app/views/buyer/carDetails/carDetails.css",
              },
            ]);
          },
        ],
        loadFlatpickr: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              serie: true,
              files: [
                "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js",
              ],
            });
          },
        ],
      },
    })
    .state("buyerBookings", {
      url: "/buyerBookings",
      templateUrl: "src/app/views/buyer/bookings/buyerBookings.html",
      controller: "BuyerBookingsController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/views/buyer/bookings/buyerBookings.css",
            });
          },
        ],
      },
    })
    .state("userDashboard", {
      url: "/userDashboard",
      templateUrl: "src/app/components/userDashboard/userDashboard.html",
      controller: "UserDashboardController",
      controllerAs: "vm",
      resolve: {
        loadCSS: [
          "$ocLazyLoad",
          function ($ocLazyLoad) {
            return $ocLazyLoad.load({
              type: "css",
              path: "src/app/components/userDashboard/userDashboard.css",
            });
          },
        ],
      },
    })
    .state('superAdmin', {
      url: '/admin',
      templateUrl: 'src/app/views/admin/dashboard/superAdmin.html',
      controller: 'SuperAdminController',
      controllerAs: 'vm',
    })
    .state('adminAnalytics', {
      url: '/admin/analytics',
      templateUrl: 'src/app/views/admin/analytics/adminAnalytics.html',
      controller: 'AdminAnalyticsController',
      controllerAs: 'vm',
    });
}
