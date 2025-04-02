'use strict';

angular
  .module('carRentalApp')
  .service('SellerListingsService', SellerListingsService);

SellerListingsService.$inject = ['$q', '$http', 'DbService', 'ValidationService', 'AuthService'];

function SellerListingsService($q, $http, DbService, ValidationService, AuthService) {
  // Base URL for API endpoints
  const API_BASE_URL = 'http://localhost:5050/api/v1';
  
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
    getCategoryByName: getCategoryByName
  };
  return service;

  function loadListings(sellerId, availability) {
    const user = AuthService.getLoggedInUser();
    
    return $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles/user`,
      headers: {
        'Authorization': user && user.token ? `Bearer ${user.token}` : undefined
      },
      withCredentials: true,
      params: {
        status: availability ? availability.toLowerCase() : undefined
      }
    })
    .then(function(response) {
      console.log('Raw API response:', response.data);
      
      // Extract vehicles array from the response
      // The API now returns {vehicles: [...], totalVehicles: n, currentPage: n, totalPages: n}
      const responseData = response.data.data || {};
      const vehicles = responseData.vehicles || [];
      
      console.log('Extracted vehicles array:', vehicles);
      
      // Return raw data - let controller use VehicleFactory
      return vehicles;
    })
    .catch(function(error) {
      console.error("Error loading listings:", error);
      // Return empty array to prevent UI breakage
      return [];
    });
  }

  function deleteListing(vehicleId) {
    const user = AuthService.getLoggedInUser();
    
    console.log('Delisting vehicle ID:', vehicleId);
    
    // Standard JSON payload instead of FormData since we're using a special endpoint
    const data = {
      status: 'unavailable'
    };
    
    return $http({
      method: 'PUT',
      url: `${API_BASE_URL}/vehicles/${vehicleId}/status`, // Use the status-specific endpoint
      headers: {
        'Authorization': user && user.token ? `Bearer ${user.token}` : undefined,
        'Content-Type': 'application/json'
      },
      withCredentials: true,
      data: data
    })
    .then(function(response) {
      console.log('Delist vehicle response:', response.data);
      return response.data.data;
    })
    .catch(function(error) {
      console.error("Error delisting vehicle:", error);
      return $q.reject(error.data?.message || error.data?.error || "Failed to delist vehicle");
    });
  }

  function listAgain(vehicleId) {
    const user = AuthService.getLoggedInUser();
    
    console.log('Relisting vehicle ID:', vehicleId);
    
    // Standard JSON payload
    const data = {
      status: 'available'
    };
    
    return $http({
      method: 'PUT',
      url: `${API_BASE_URL}/vehicles/${vehicleId}/status`, // Use the status-specific endpoint
      headers: {
        'Authorization': user && user.token ? `Bearer ${user.token}` : undefined,
        'Content-Type': 'application/json'
      },
      withCredentials: true,
      data: data
    })
    .then(function(response) {
      console.log('Relist vehicle response:', response.data);
      return response.data.data;
    })
    .catch(function(error) {
      console.error("Error relisting vehicle:", error);
      return $q.reject(error.data?.message || error.data?.error || "Failed to relist vehicle");
    });
  }

  function addCar(carData, imageFiles) {
    return AuthService.getLoggedInUser().then(function(user) {
      if (!user || !user._id) {
        console.error('User not logged in or missing ID');
        return $q.reject("User not logged in. Cannot add car.");
      }

      if (!imageFiles || imageFiles.length === 0) {
        console.error('No image files provided');
        return $q.reject("At least one image file is required.");
      }
      console.log(carData);
      // Create FormData
      const formData = new FormData();

      console.log('=== Initial Car Data Debug ===');
      console.log('Full carData object:', carData);

      // Basic required fields - using the actual data from the form
      formData.append('title', carData.vehicleModel || carData.title || '');
      formData.append('description', carData.vehicleNumber || carData.description || ''); 
      formData.append('basePrice', carData.pricing?.basePrice?.toString() || '0');
      formData.append('basePriceOutstation', carData.pricing?.basePriceOutstation?.toString() || '0');
      formData.append('location', carData.location || '');

      // Category fields - use the actual data from the form
      const supercategoryId = carData.supercategory_id || carData.supercategory || '';
      const categoryId = carData.category_id || carData.category || '';

      // Category metadata required by backend
      formData.append('supercategory', supercategoryId);
      formData.append('category', categoryId);
      
      // Use actual category name/description data if available
      formData.append('category_name', carData.category_name || 'Cars');
      formData.append('category_description', carData.category_description || 'All types of cars available for rent');
      formData.append('supercategory_name', carData.supercategory_name || 'Vehicles');
      formData.append('supercategory_description', carData.supercategory_description || 'All types of vehicles available for rent');

      // Owner and status
      formData.append('owner', user._id);
      formData.append('status', 'available');

      // Features and specifications - use actual data with fallbacks
      const features = carData.features && carData.features.length > 0 
        ? carData.features 
        : ['Spacious', 'Air Conditioning', 'Power Steering'];
      formData.append('features', JSON.stringify(features));

      // Add specifications from carData or use defaults
      const specifications = carData.specifications || {
        'engine': carData.engine || '1.2L',
        'transmission': carData.transmission || 'Manual',
        'fuelType': carData.fuelType || 'Petrol',
        'seatingCapacity': carData.seatingCapacity || '5'
      };
      formData.append('specifications', JSON.stringify(specifications));

      // Add images - using the exact field name expected by the backend
      if (imageFiles && imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          formData.append('vehicleImages', imageFiles[i]);
        }
      }

      // Debug logging
      console.log('=== FormData Contents Before Submission ===');
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
          console.log(pair[0] + ': [File]', pair[1].name, pair[1].type, pair[1].size + ' bytes');
        } else {
          console.log(pair[0] + ':', pair[1]);
        }
      }

      // Make API call
    return $http({
      method: 'POST',
      url: `${API_BASE_URL}/vehicles`,
      data: formData,
      headers: {
          'Content-Type': undefined,
          'Authorization': `Bearer ${user.token}`
      },
        withCredentials: true,
        transformRequest: angular.identity
    })
    .then(function(response) {
        console.log('=== Success Response ===');
        console.log('Response:', response.data);
        return response.data.data;
    })
    .catch(function(error) {
        console.log('=== Error Response ===');
        console.log('Error Status:', error.status);
        console.log('Error Data:', error.data);
        console.log('Error Headers:', error.headers ? error.headers() : {});
        
        // Try to get detailed error information
        let errorMessage = 'Failed to add car';
      if (error.data) {
          if (error.data.message) errorMessage = error.data.message;
          if (error.data.errors && error.data.errors.length > 0) {
            errorMessage += ': ' + error.data.errors.join(', ');
          }
      }
      
      return $q.reject(errorMessage);
      });
    });
  }

  function loadSuperCategories() {
    return $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles/supercategories`
    })
    .then(function(response) {
      // Transform data to be compatible with existing frontend code
      const superCategories = (response.data.data || []).map(cat => ({
        supercategory_id: cat._id,
        superCategory_name: cat.name,
        description: cat.description
      }));
      return superCategories;
    })
    .catch(function(error) {
      console.error("Error loading super categories:", error);
      return $q.reject("Failed to load super categories. Please try again.");
    });
  }

  function loadCategories(superCategoryIdOrName) {
    console.log('Loading categories for supercategory:', superCategoryIdOrName);
    
    if (!superCategoryIdOrName) {
      console.warn('No supercategory provided to loadCategories');
      return $q.resolve([]);
    }
    
    // Log the request details for debugging
    console.log('Making API request to categories endpoint with params:', {
      supercategory: superCategoryIdOrName
    });
    
    return $http({
      method: 'GET',
      url: `${API_BASE_URL}/vehicles/categories`,
      params: {
        supercategory: superCategoryIdOrName
      }
    })
    .then(function(response) {
      // Transform data to be compatible with existing frontend code
      const categories = (response.data.data || []).map(cat => ({
        category_id: cat._id,
        category_name: cat.name,
        description: cat.description
      }));
      return categories;
    })
    .catch(function(error) {
      console.error("Error loading categories:", error);
      return $q.reject("Failed to load categories. Please try again.");
    });
  }

  function saveNewSuperCategory(name) {
    const user = AuthService.getLoggedInUser();
    
    return $http({
      method: 'POST',
      url: `${API_BASE_URL}/vehicles/supercategories`,
      headers: {
        'Authorization': user && user.token ? `Bearer ${user.token}` : undefined,
        'Content-Type': 'application/json'
      },
      data: {
        name: name,
        description: `Custom supercategory: ${name}`
      },
      withCredentials: true
    })
    .then(function(response) {
      return {
        supercategory_id: response.data.data._id,
        superCategory_name: response.data.data.name,
        description: response.data.data.description
      };
    })
    .catch(function(error) {
      console.error("Error creating supercategory:", error);
      return $q.reject("Failed to create new category type. Please try again.");
    });
  }

  function saveNewCategory(catName, superCatNameOrId) {
    const user = AuthService.getLoggedInUser();
    
    // First find the supercategory if needed
    let superCatPromise;
    
    if (!superCatNameOrId) {
      return $q.reject("Supercategory is required to create a category");
    }
    
    // If we have the ID, use it directly
    if (typeof superCatNameOrId === 'string' && superCatNameOrId.length > 0) {
      superCatPromise = $q.resolve(superCatNameOrId);
    } else {
      // Find by name
      superCatPromise = getSuperCategoryByName(superCatNameOrId)
        .then(function(superCat) {
          if (!superCat) {
            return $q.reject("Supercategory not found: " + superCatNameOrId);
          }
          return superCat.supercategory_id;
        });
    }
    
    return superCatPromise.then(function(superCategoryId) {
    return $http({
      method: 'POST',
      url: `${API_BASE_URL}/vehicles/categories`,
      headers: {
          'Authorization': user && user.token ? `Bearer ${user.token}` : undefined,
          'Content-Type': 'application/json'
      },
      data: {
        name: catName,
          description: `Custom category: ${catName}`,
          supercategory: superCategoryId
        },
        withCredentials: true
    })
    .then(function(response) {
        return {
          category_id: response.data.data._id,
          category_name: response.data.data.name,
          description: response.data.data.description
        };
      });
    })
    .catch(function(error) {
      console.error("Error creating category:", error);
      return $q.reject("Failed to create new category. Please try again.");
    });
  }

  function getSuperCategoryByName(name) {
    if (!name) {
      return $q.reject("Supercategory name is required");
    }
    
    return loadSuperCategories()
      .then(function(superCats) {
        const foundCat = superCats.find(function(sc) {
          return sc.superCategory_name.toLowerCase() === name.toLowerCase();
        });
        
        if (!foundCat) {
          console.log("Supercategory not found:", name);
          return null;
        }
        
        return foundCat;
    });
  }

  function getCategoryByName(name, superCatName) {
    if (!name) {
      return $q.reject("Category name is required");
    }
    
    return loadCategories(superCatName)
      .then(function(cats) {
        const foundCat = cats.find(function(c) {
          return c.category_name.toLowerCase() === name.toLowerCase();
        });
        
        if (!foundCat) {
          console.log("Category not found:", name);
          return null;
        }
        
        return foundCat;
    });
  }
}
