'use strict';

angular
  .module('carRentalApp')
  .factory('VehicleFactory', VehicleFactory);

VehicleFactory.$inject = [];

function VehicleFactory() {
  // Vehicle class constructor
  function Vehicle(data) {
    
    this.vehicle_id = data.vehicle_id || data._id || null;
    this.owner = data.owner || null;
    this.owner_details = data.owner_details || null;
    this.vehicleModel = data.vehicleModel || data.title || '';
    this.vehicleNumber = data.vehicleNumber || data.description || '';
    this.pricing = {
      basePrice: data.pricing?.basePrice || data.basePrice || 0,
      basePriceOutstation: data.pricing?.basePriceOutstation || data.basePriceOutstation || 0
    };
    this.location = data.location || '';
    this.address = data.address || null;
    this.address_details = data.address_details || null;
    this.availability = data.availability || data.status || 'available';
    this.availabilityPeriods = data.availabilityPeriods || [];
    this.images_URL = data.images_URL || data.images || [];
    this.features = data.features || [];
    this.specifications = data.specifications || {};
    this.superCategory = data.superCategory || data.supercategory_name || '';
    this.category = data.category || data.category_name || '';
    this.rating = data.rating || { average: 0, count: 0 };
    this.created_at = data.created_at || data.createdAt || new Date().toISOString();
    this.updated_at = data.updated_at || data.updatedAt || this.created_at;
  }

  // Status check methods
  Vehicle.prototype.isAvailable = function() {
    return this.availability === 'available';
  };

  Vehicle.prototype.isUnavailable = function() {
    return this.availability === 'unavailable';
  };

  Vehicle.prototype.isInMaintenance = function() {
    return this.availability === 'maintenance';
  };

  Vehicle.prototype.isDeleted = function() {
    return this.availability === 'deleted';
  };

  // Status update methods
  Vehicle.prototype.setAvailable = function() {
    this.availability = 'available';
    this.updated_at = new Date().toISOString();
    return this;
  };

  Vehicle.prototype.setUnavailable = function() {
    this.availability = 'unavailable';
    this.updated_at = new Date().toISOString();
    return this;
  };

  Vehicle.prototype.setMaintenance = function() {
    this.availability = 'maintenance';
    this.updated_at = new Date().toISOString();
    return this;
  };

  Vehicle.prototype.setDeleted = function() {
    this.availability = 'deleted';
    this.updated_at = new Date().toISOString();
    return this;
  };

  // Formatting methods
  Vehicle.prototype.getFormattedPrice = function() {
    return '₹' + this.pricing.basePrice.toFixed(2);
  };

  Vehicle.prototype.getFormattedOutstationPrice = function() {
    return '₹' + (this.pricing.basePriceOutstation || this.pricing.basePrice).toFixed(2);
  };

  Vehicle.prototype.getMainImage = function() {
    return this.images_URL && this.images_URL.length > 0 
      ? this.images_URL[0] 
      : 'assets/images/default-car.jpg';
  };

  Vehicle.prototype.getFormattedFeatures = function() {
    return this.features && this.features.length > 0 
      ? this.features.join(', ')
      : 'No features listed';
  };

  Vehicle.prototype.getFormattedCreationDate = function() {
    return new Date(this.created_at).toLocaleDateString();
  };

  // Price calculation methods
  Vehicle.prototype.calculateRentalPrice = function(startDate, endDate, isOutstation) {
    if (!startDate || !endDate) {
      return 0;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return 0;
    }
    
    // Calculate number of days (add 1 since both start and end dates are inclusive)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // Use outstation price if specified, otherwise base price
    const pricePerDay = isOutstation && this.pricing.basePriceOutstation
      ? this.pricing.basePriceOutstation
      : this.pricing.basePrice;
    
    return pricePerDay * daysDiff;
  };

  Vehicle.prototype.getFormattedTotalPrice = function(startDate, endDate, isOutstation) {
    const totalPrice = this.calculateRentalPrice(startDate, endDate, isOutstation);
    return '₹' + totalPrice.toFixed(2);
  };

  // Availability management methods
  Vehicle.prototype.addAvailabilityPeriod = function(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    if (isNaN(start.getTime()) || (end && isNaN(end.getTime()))) {
      return false;
    }
    
    if (end && end <= start) {
      return false;
    }
    
    this.availabilityPeriods.push({
      start_date: start.toISOString(),
      end_date: end ? end.toISOString() : null
    });
    
    this.updated_at = new Date().toISOString();
    return true;
  };

  Vehicle.prototype.removeAvailabilityPeriod = function(index) {
    if (index < 0 || index >= this.availabilityPeriods.length) {
      return false;
    }
    
    this.availabilityPeriods.splice(index, 1);
    this.updated_at = new Date().toISOString();
    return true;
  };

  Vehicle.prototype.isAvailableOnDate = function(date) {
    if (!this.isAvailable() || !this.availabilityPeriods || this.availabilityPeriods.length === 0) {
      return false;
    }
    
    const checkDate = new Date(date);
    if (isNaN(checkDate.getTime())) {
      return false;
    }
    
    return this.availabilityPeriods.some(period => {
      const startDate = new Date(period.start_date);
      const endDate = period.end_date ? new Date(period.end_date) : null;
      
      if (checkDate < startDate) {
        return false;
      }
      
      if (endDate && checkDate > endDate) {
        return false;
      }
      
      return true;
    });
  };

  Vehicle.prototype.isAvailableBetweenDates = function(startDate, endDate) {
    if (!this.isAvailable()) {
      return false;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return false;
    }
    
    // For simplicity, check if every day in the range is available
    // In a real implementation, you might use a more efficient algorithm
    let current = new Date(start);
    while (current <= end) {
      if (!this.isAvailableOnDate(current)) {
        return false;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  };

  // Feature management methods
  Vehicle.prototype.addFeature = function(feature) {
    if (!feature || typeof feature !== 'string' || feature.trim() === '') {
      return false;
    }
    
    if (!this.features) {
      this.features = [];
    }
    
    if (!this.features.includes(feature)) {
      this.features.push(feature);
      this.updated_at = new Date().toISOString();
      return true;
    }
    
    return false;
  };

  Vehicle.prototype.removeFeature = function(feature) {
    if (!this.features || !feature) {
      return false;
    }
    
    const index = this.features.indexOf(feature);
    if (index !== -1) {
      this.features.splice(index, 1);
      this.updated_at = new Date().toISOString();
      return true;
    }
    
    return false;
  };

  // Image management methods
  Vehicle.prototype.addImage = function(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      return false;
    }
    
    if (!this.images_URL) {
      this.images_URL = [];
    }
    
    this.images_URL.push(imageUrl);
    this.updated_at = new Date().toISOString();
    return true;
  };

  Vehicle.prototype.removeImage = function(index) {
    if (!this.images_URL || index < 0 || index >= this.images_URL.length) {
      return false;
    }
    
    this.images_URL.splice(index, 1);
    this.updated_at = new Date().toISOString();
    return true;
  };

  Vehicle.prototype.setMainImage = function(index) {
    if (!this.images_URL || index < 0 || index >= this.images_URL.length) {
      return false;
    }
    
    // Move the selected image to the first position
    const selectedImage = this.images_URL[index];
    this.images_URL.splice(index, 1);
    this.images_URL.unshift(selectedImage);
    this.updated_at = new Date().toISOString();
    return true;
  };

  // Specification management methods
  Vehicle.prototype.addSpecification = function(key, value) {
    if (!key || typeof key !== 'string' || key.trim() === '') {
      return false;
    }
    
    if (!this.specifications) {
      this.specifications = {};
    }
    
    this.specifications[key] = value;
    this.updated_at = new Date().toISOString();
    return true;
  };

  Vehicle.prototype.removeSpecification = function(key) {
    if (!this.specifications || !key || !this.specifications[key]) {
      return false;
    }
    
    delete this.specifications[key];
    this.updated_at = new Date().toISOString();
    return true;
  };

  // Validation methods
  Vehicle.prototype.validate = function() {
    const errors = [];
    
    // Required fields validation
    if (!this.vehicleModel) {
      errors.push("Vehicle model/title is required");
    }
    
    if (!this.vehicleNumber) {
      errors.push("Vehicle number/description is required");
    }
    
    // Price validation
    if (!this.pricing || this.pricing.basePrice === undefined || this.pricing.basePrice === null) {
      errors.push("Base price is required");
    } else if (isNaN(this.pricing.basePrice)) {
      errors.push("Base price must be a number");
    } else if (this.pricing.basePrice <= 0) {
      errors.push("Base price must be greater than zero");
    } else if (this.pricing.basePrice > 1000000) {
      errors.push("Base price is too high");
    }
    
    // Outstation price validation (if provided)
    if (this.pricing.basePriceOutstation !== undefined && this.pricing.basePriceOutstation !== null) {
      if (isNaN(this.pricing.basePriceOutstation)) {
        errors.push("Outstation price must be a number");
      } else if (this.pricing.basePriceOutstation <= 0) {
        errors.push("Outstation price must be greater than zero");
      } else if (this.pricing.basePriceOutstation < this.pricing.basePrice) {
        errors.push("Outstation price should not be less than base price");
      }
    }
    
    // Location validation
    if (!this.location) {
      errors.push("Location is required");
    }
    
    // Category validation
    if (!this.superCategory) {
      errors.push("Super category is required");
    }
    
    if (!this.category) {
      errors.push("Category is required");
    }
    
    // Features validation
    if (this.features && !Array.isArray(this.features)) {
      errors.push("Features must be an array");
    }
    
    // Images validation
    if (this.images_URL && !Array.isArray(this.images_URL)) {
      errors.push("Images must be an array");
    }
    
    return errors;
  };

  Vehicle.prototype.validateStatus = function() {
    const validStatuses = ['available', 'unavailable', 'maintenance', 'deleted'];
    if (!this.availability) {
      return ["Status is required"];
    }
    if (!validStatuses.includes(this.availability.toLowerCase())) {
      return [`Invalid status: ${this.availability}. Must be one of: ${validStatuses.join(', ')}`];
    }
    return [];
  };

  // Data transformation for API
  Vehicle.prototype.toFormData = function() {
    let formData = new FormData();
    
    formData.append('title', this.vehicleModel);
    formData.append('description', this.vehicleNumber);
    formData.append('basePrice', this.pricing.basePrice.toString());
    
    if (this.pricing.basePriceOutstation) {
      formData.append('basePriceOutstation', this.pricing.basePriceOutstation.toString());
    }
    
    formData.append('location', this.location || '');
    
    // Handle category and supercategory
    if (this.category) {
      if (/^[0-9a-f]{24}$/.test(this.category)) {
        formData.append('category_id', this.category);
      } else {
        formData.append('category_name', this.category);
      }
    }
    
    if (this.superCategory) {
      if (/^[0-9a-f]{24}$/.test(this.superCategory)) {
        formData.append('supercategory_id', this.superCategory);
      } else {
        formData.append('supercategory_name', this.superCategory);
      }
    }
    
    if (this.specifications) {
      formData.append('specifications', JSON.stringify(this.specifications));
    }
    
    // Set availability
    formData.append('availability', JSON.stringify(this.availabilityPeriods.length > 0 
      ? this.availabilityPeriods 
      : [{
        start_date: new Date().toISOString(),
        end_date: null
      }]));
    
    if (this.features) {
      formData.append('features', JSON.stringify(Array.isArray(this.features) ? this.features : [this.features]));
    } else {
      formData.append('features', JSON.stringify([]));
    }
    
    return formData;
  };

  Vehicle.prototype.toJSON = function() {
    return {
      vehicle_id: this.vehicle_id,
      owner: this.owner,
      owner_details: this.owner_details,
      title: this.vehicleModel,
      description: this.vehicleNumber,
      pricing: {
        basePrice: Number(this.pricing.basePrice),
        basePriceOutstation: Number(this.pricing.basePriceOutstation || this.pricing.basePrice)
      },
      location: this.location,
      address: this.address,
      address_details: this.address_details,
      status: this.availability,
      availability: this.availabilityPeriods,
      images: this.images_URL,
      features: this.features,
      specifications: this.specifications,
      supercategory_name: this.superCategory,
      category_name: this.category,
      rating: this.rating,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  };

  // Factory methods
  return {
    createVehicle: function(data) {
      return new Vehicle(data);
    },
    
    createVehicleArray: function(vehiclesData) {
      return vehiclesData.map(function(vehicleData) {
        return new Vehicle(vehicleData);
      });
    },
    
    validateVehicle: function(vehicleData, validationType) {
      const vehicle = vehicleData instanceof Vehicle ? vehicleData : new Vehicle(vehicleData);
      let errors = [];
      
      // Validate based on validation type
      if (validationType === 'status' || validationType === 'full') {
        errors = errors.concat(vehicle.validateStatus());
      }
      
      if (validationType === 'creation' || validationType === 'full' || !validationType) {
        errors = errors.concat(vehicle.validate());
      }
      
      return errors;
    },
    
    validatePrices: function(basePrice, outstationPrice) {
      const errors = [];
      
      if (basePrice === undefined || basePrice === null) {
        errors.push("Base price is required");
      } else if (isNaN(parseFloat(basePrice))) {
        errors.push("Base price must be a number");
      } else if (parseFloat(basePrice) <= 0) {
        errors.push("Base price must be greater than zero");
      }
      
      if (outstationPrice !== undefined && outstationPrice !== null) {
        if (isNaN(parseFloat(outstationPrice))) {
          errors.push("Outstation price must be a number");
        } else if (parseFloat(outstationPrice) <= 0) {
          errors.push("Outstation price must be greater than zero");
        } else if (parseFloat(outstationPrice) < parseFloat(basePrice)) {
          errors.push("Outstation price should not be less than base price");
        }
      }
      
      return errors;
    },
    
    validateAvailability: function(startDate, endDate) {
      const errors = [];
      
      if (!startDate) {
        errors.push("Start date is required");
        return errors;
      }
      
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        errors.push("Invalid start date format");
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          errors.push("Invalid end date format");
        }
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
          errors.push("End date must be after start date");
        }
      }
      
      return errors;
    }
  };
} 