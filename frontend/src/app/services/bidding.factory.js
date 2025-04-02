'use strict';

angular
  .module('carRentalApp')
  .factory('BiddingFactory', BiddingFactory);

BiddingFactory.$inject = [];

function BiddingFactory() {
  // Bidding class constructor
  function Bidding(data) {
    this.bid_id = data.bid_id || data._id || null;
    this.vehicle = data.vehicle_id || data.vehicle || null;
    this.bidder = data.bidder || null;
    this.seller = data.seller || null;
    this.bid_amount = data.bid_amount || 0;
    this.bid_status = data.bid_status || 'pending';
    this.bid_message = data.bid_message || '';
    this.booking_start_date = data.booking_start_date || data.start_date || null;
    this.booking_end_date = data.booking_end_date || data.end_date || null;
    this.bid_date = data.bid_date || data.createdAt || new Date().toISOString();
    this.response_date = data.response_date || null;
    this.response_message = data.response_message || '';
    this.is_outstation = data.is_outstation || false;
    this.vehicle_details = data.vehicle_details || null;
    this.createdAt = data.createdAt || this.bid_date;
    this.updatedAt = data.updatedAt || data.updated_at || this.createdAt;
  }

  // Status check methods
  Bidding.prototype.isPending = function() {
    return this.bid_status.toLowerCase() === 'pending';
  };

  Bidding.prototype.isAccepted = function() {
    return this.bid_status.toLowerCase() === 'accepted';
  };

  Bidding.prototype.isRejected = function() {
    return this.bid_status.toLowerCase() === 'rejected';
  };

  Bidding.prototype.isCancelled = function() {
    return this.bid_status.toLowerCase() === 'cancelled';
  };

  Bidding.prototype.isConverted = function() {
    return this.bid_status.toLowerCase() === 'converted';
  };

  // Formatting and validation methods
  Bidding.prototype.getFormattedAmount = function() {
    return '₹' + this.bid_amount.toFixed(2);
  };

  Bidding.prototype.validate = function() {
    const errors = [];
    
    // Required fields validation
    if (!this.vehicle) {
      errors.push("Vehicle ID is required");
    }
    
    // Bid amount validation
    if (this.bid_amount === undefined || this.bid_amount === null) {
      errors.push("Bid amount is required");
    } else if (isNaN(this.bid_amount)) {
      errors.push("Bid amount must be a number");
    } else if (this.bid_amount <= 0) {
      errors.push("Bid amount must be greater than zero");
    } else if (this.bid_amount > 1000000) { 
      errors.push("Bid amount is too high");
    }
    
    // Date validations
    if (!this.booking_start_date) {
      errors.push("Booking start date is required");
    }
    
    if (!this.booking_end_date) {
      errors.push("Booking end date is required");
    }
    
    // Compare dates if both are present
    if (this.booking_start_date && this.booking_end_date) {
      const startDate = new Date(this.booking_start_date);
      const endDate = new Date(this.booking_end_date);
      const today = new Date();
      
      
      
      if (isNaN(startDate.getTime())) {
        errors.push("Invalid start date format");
      }
      
      if (isNaN(endDate.getTime())) {
        errors.push("Invalid end date format");
      }
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        // Allow bookings starting from today (not yesterday or earlier)
        if (startDate < today) {
          errors.push("Start date cannot be in the past");
        }
        
        if (endDate < startDate) {
          errors.push("End date must be after start date");
        }
        
        // Maximum rental duration check (e.g., 90 days)
        const daysDiff = (endDate - startDate +1) / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) {
          errors.push("Booking duration cannot exceed 90 days");
        }
      }
    }
    
    // Validate bid message length if present
    if (this.bid_message && this.bid_message.length > 500) {
      errors.push("Bid message is too long (maximum 500 characters)");
    }
    
    return errors;
  };

  // Additional validation methods
  Bidding.prototype.validateStatus = function() {
    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'converted'];
    if (!this.bid_status) {
      return ["Status is required"];
    }
    if (!validStatuses.includes(this.bid_status.toLowerCase())) {
      return [`Invalid status: ${this.bid_status}. Must be one of: ${validStatuses.join(', ')}`];
    }
    return [];
  };

  // Data transformation for API
  Bidding.prototype.toApiData = function() {
    // Format dates properly for API
    const startDate = this.booking_start_date instanceof Date 
      ? this.booking_start_date.toISOString() 
      : this.booking_start_date;
    
    const endDate = this.booking_end_date instanceof Date
      ? this.booking_end_date.toISOString()
      : this.booking_end_date;
    
    return {
      vehicleId: this.vehicle,
      bidAmount: Number(this.bid_amount),
      bidMessage: this.bid_message,
      bookingStartDate: startDate,
      bookingEndDate: endDate,
      isOutstation: this.is_outstation,
      bidStatus: this.bid_status
    };
  };

  // Methods to create and validate Bidding instances
  return {
    createBidding: function(data) {
      return new Bidding(data);
    },
    
    createBiddingArray: function(biddingsData) {
      return biddingsData.map(function(biddingData) {
        return new Bidding(biddingData);
      });
    },
    
    validateBid: function(bidData, validationType) {
      const bid = bidData instanceof Bidding ? bidData : new Bidding(bidData);
      let errors = [];
      
      // Validate based on validation type
      if (validationType === 'status' || validationType === 'full') {
        errors = errors.concat(bid.validateStatus());
      }
      
      if (validationType === 'creation' || validationType === 'full' || !validationType) {
        // Basic validation
        // Required fields
        if (!bid.vehicle) {
          errors.push("Vehicle ID is required");
        }
        
        // Bid amount validation
        if (bid.bid_amount === undefined || bid.bid_amount === null) {
          errors.push("Bid amount is required");
        } else if (isNaN(bid.bid_amount)) {
          errors.push("Bid amount must be a number");
        } else if (Number(bid.bid_amount) <= 0) {
          errors.push("Bid amount must be greater than zero");
        } else if (Number(bid.bid_amount) > 1000000) { 
          errors.push("Bid amount is too high");
        }
        
        // Bid message validation
        if (bid.bid_message && bid.bid_message.length > 500) {
          errors.push("Bid message is too long (maximum 500 characters)");
        }
      }
      
      if (validationType === 'dates' || validationType === 'creation' || validationType === 'full' || !validationType) {
        // Date validations
        if (!bid.booking_start_date) {
          errors.push("Booking start date is required");
        }
        
        if (!bid.booking_end_date) {
          errors.push("Booking end date is required");
        }
        
        // Compare dates if both are present
        if (bid.booking_start_date && bid.booking_end_date) {
          const startDate = new Date(bid.booking_start_date);
          const endDate = new Date(bid.booking_end_date);
          const today = new Date();
          
          // Clear time portions for fair comparison
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          
          if (isNaN(startDate.getTime())) {
            errors.push("Invalid start date format");
          }
          
          if (isNaN(endDate.getTime())) {
            errors.push("Invalid end date format");
          }
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            // Allow bookings starting from today (not yesterday or earlier)
            if (startDate < today) {
              errors.push("Start date cannot be in the past");
            }
            
            if (endDate <= startDate) {
              errors.push("End date must be after start date");
            }
            
            // Maximum rental duration check (e.g., 90 days)
            const daysDiff = (endDate - startDate + 1) / (1000 * 60 * 60 * 24);
            if (daysDiff > 90) {
              errors.push("Booking duration cannot exceed 90 days");
            }
          }
        }
      }
      
      return errors;
    },
    
    // Prices validation
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
    }
  };
} 