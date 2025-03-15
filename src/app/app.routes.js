// src/app/app.routes.js

  "use strict";

  angular.module("carRentalApp").config(configRoutes);

  configRoutes.$inject = [
    "$stateProvider",
    "$urlRouterProvider",
    "$ocLazyLoadProvider",
    "$locationProvider",
  ];

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
        templateUrl: "/src/app/views/landingPage/landingPage.html",
        controller: "LandingPageController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/landingPage/landingPage.css",
              });
            },
          ],
        },
      })
      .state("login", {
        url: "/login",
        templateUrl: "/src/app/views/auth/login/login.html",
        controller: "LoginController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/auth/login/login.css",
              });
            },
          ],
        },
      })
      .state("signup", {
        url: "/signup",
        templateUrl: "/src/app/views/auth/signup/signup.html",
        controller: "SellerSignupController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/auth/signup/signup.css",
              });
            },
          ],
        },
      })
      .state("buyerHome", {
        url: "/buyerHome",
        templateUrl: "/src/app/views/buyer/homePage/buyerHomePage.html",
        controller: "BuyerHomeController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load([
                {
                  type: "css",
                  path: "/src/app/views/buyer/homePage/buyerHomePage.css",
                },
                {
                  type: "css",
                  path: "/src/app/components/navbar/navbar.css",
                },
              ]);
            },
          ],
        },
      })
      .state("sellerDashboard", {
        url: "/sellerDashboard",
        templateUrl: "/src/app/views/seller/dashboard/sellerDashboard.html",
        controller: "SellerDashboardController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/seller/dashboard/sellerDashboard.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('seller').catch(function() {
              $state.go('login');
              return false;
            });
          }]
        },
      })
      .state("sellerListings", {
        url: "/sellerListings",
        templateUrl: "/src/app/views/seller/listings/sellerListings.html",
        controller: "SellerListingsController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/seller/listings/sellerListings.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('seller').catch(() => {
              $state.go('login');
              return false;
            });
          }]
        },
      })
      .state("sellerBookings", {
        url: "/sellerBookings",
        templateUrl: "/src/app/views/seller/bookings/sellerBookings.html",
        controller: "SellerBookingsController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/seller/bookings/sellerBookings.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('seller').catch(function() {
              $state.go('login');
              return false;
            });
          }]
        },
      })
      .state("sellerAnalytics", {
        url: "/sellerAnalytics",
        templateUrl: "/src/app/views/seller/analytics/sellerAnalytics.html",
        controller: "SellerAnalyticsController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/seller/analytics/sellerAnalytics.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('seller').catch(function() {
              $state.go('login');
              return false;
            });
          }]
        },
      })

      .state("conversations", {
        url: "/conversations",
        templateUrl: "/src/app/components/messaging/conversations.html",
        controller: "ConversationsController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/components/messaging/conversations.css",
              });
            },
          ],
        },
      })
      .state("chat", {
        url: "/chat?conversationId",
        templateUrl: "/src/app/components/messaging/chat.html",
        controller: "ChatController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/components/messaging/conversations.css",
              });
            },
          ],
        },
      })
      .state("carDetails", {
        url: "/carDetails?carId",
        templateUrl: "/src/app/views/buyer/carDetails/carDetails.html",
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
                  path: "/src/app/views/buyer/carDetails/carDetails.css",
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
        templateUrl: "/src/app/views/buyer/bookings/buyerBookings.html",
        controller: "BuyerBookingsController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/views/buyer/bookings/buyerBookings.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('buyer').catch(function() {
              $state.go('login');
              return false;
            });
          }]
        },
      })
      .state("userDashboard", {
        url: "/userDashboard",
        templateUrl: "/src/app/components/userDashboard/userDashboard.html",
        controller: "UserDashboardController",
        controllerAs: "vm",
        resolve: {
          loadCSS: [
            "$ocLazyLoad",
            function ($ocLazyLoad) {
              return $ocLazyLoad.load({
                type: "css",
                path: "/src/app/components/userDashboard/userDashboard.css",
              });
            },
          ],
          auth: ['AuthService', '$state', function(AuthService, $state) {
            return AuthService.isLoggedInAs('buyer').catch(function() {
              return AuthService.isLoggedInAs('seller').catch(function() {
                return AuthService.isLoggedInAs('admin').catch(function() {
                  $state.go('login');
                  return false;
                });
              });
            });
          }]
        },
      })
      .state('superAdmin', {
        url: '/admin',
        templateUrl: '/src/app/views/admin/dashboard/superAdmin.html',
        controller: 'SuperAdminController',
        controllerAs: 'vm',
        resolve: {
          auth: ['AuthService', '$state', function(AuthService, $state) {
            const user = AuthService.getLoggedInUser();
            if (!user || !user.user_role.includes('admin')) {
              $state.go('login');
              return false;
            }
            return true;
          }]
        }
      })
      .state('adminAnalytics', {
        url: '/admin/analytics',
        templateUrl: '/src/app/views/admin/analytics/adminAnalytics.html',
        controller: 'AdminAnalyticsController',
        controllerAs: 'vm',
        resolve: {
          auth: ['AuthService', '$state', function(AuthService, $state) {
            const user = AuthService.getLoggedInUser();
            if (!user || !user.user_role.includes('admin')) {
              $state.go('login');
              return false;
            }
            return true;
          }]
        }
      });
  }
