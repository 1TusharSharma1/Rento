'use strict';

angular
  .module('carRentalApp')
  .factory('BookingFactory', BookingFactory);

BookingFactory.$inject = [];

function BookingFactory() {
  // Booking class constructor
  function Booking(data) {
    this.booking_id = data.booking_id || data._id || null;
    this.vehicle = data.vehicle || null;
    this.vehicle_details = data.vehicle_details || null;
    this.bid = data.bid || null;
    this.renter = data.renter || null;
    this.seller = data.seller || null;
    this.booking_start_date = data.booking_start_date || null;
    this.booking_end_date = data.booking_end_date || null;
    this.is_outstation = data.is_outstation || false;
    this.total_price = data.total_price || 0;
    this.status = data.status || 'pending';
    this.payment_status = data.payment_status || 'pending';
    this.payment_id = data.payment_id || null;
    
    // Parse odometer readings to ensure they are numbers
    if (data.initial_odometer_reading !== undefined && data.initial_odometer_reading !== null) {
      this.initial_odometer_reading = parseFloat(data.initial_odometer_reading);
      if (isNaN(this.initial_odometer_reading)) {
        this.initial_odometer_reading = 0;
        console.warn("Invalid initial_odometer_reading value in booking data", data.initial_odometer_reading);
      }
    } else {
      this.initial_odometer_reading = null;
    }
    
    if (data.final_odometer_reading !== undefined && data.final_odometer_reading !== null) {
      this.final_odometer_reading = parseFloat(data.final_odometer_reading);
      if (isNaN(this.final_odometer_reading)) {
        this.final_odometer_reading = 0;
        console.warn("Invalid final_odometer_reading value in booking data", data.final_odometer_reading);
      }
    } else {
      this.final_odometer_reading = null;
    }
    
    this.trip_start_time = data.trip_start_time || null;
    this.trip_end_time = data.trip_end_time || null;
    
    // Parse extra charges and total_km as numbers
    if (data.extra_charges !== undefined && data.extra_charges !== null) {
      this.extra_charges = parseFloat(data.extra_charges);
      if (isNaN(this.extra_charges)) {
        this.extra_charges = 0;
        console.warn("Invalid extra_charges value in booking data", data.extra_charges);
      }
    } else {
      this.extra_charges = 0;
    }
    
    if (data.total_km !== undefined && data.total_km !== null) {
      this.total_km = parseFloat(data.total_km);
      if (isNaN(this.total_km)) {
        this.total_km = 0;
        console.warn("Invalid total_km value in booking data", data.total_km);
      }
    } else {
      this.total_km = 0;
    }
    
    this.cancellation_reason = data.cancellation_reason || null;
    this.cancellation_date = data.cancellation_date || null;
    this.review = data.review || null;
    this.createdAt = data.createdAt || data.created_at || new Date().toISOString();
    this.updatedAt = data.updatedAt || data.updated_at || this.createdAt;
    
    // Log the constructed booking
    console.log("[BookingFactory] Created booking with odometer readings:", {
      initial: this.initial_odometer_reading,
      final: this.final_odometer_reading,
      total_km: this.total_km
    });
  }

  // Status check methods
  Booking.prototype.isPending = function() {
    return this.status.toLowerCase() === 'pending';
  };

  Booking.prototype.isConfirmed = function() {
    return this.status.toLowerCase() === 'confirmed';
  };

  Booking.prototype.isInProgress = function() {
    return this.status.toLowerCase() === 'in_progress';
  };

  Booking.prototype.isCancelled = function() {
    return this.status.toLowerCase() === 'cancelled';
  };

  Booking.prototype.isCompleted = function() {
    return this.status.toLowerCase() === 'completed';
  };

  // Payment status check methods
  Booking.prototype.isPaymentPending = function() {
    return this.payment_status.toLowerCase() === 'pending';
  };

  Booking.prototype.isPaymentPaid = function() {
    return this.payment_status.toLowerCase() === 'paid';
  };

  Booking.prototype.isPaymentRefunded = function() {
    return this.payment_status.toLowerCase() === 'refunded';
  };

  Booking.prototype.isPaymentFailed = function() {
    return this.payment_status.toLowerCase() === 'failed';
  };

  // Status update methods
  Booking.prototype.setPending = function() {
    this.status = 'pending';
    this.updatedAt = new Date().toISOString();
    return this;
  };

  Booking.prototype.setConfirmed = function() {
    this.status = 'confirmed';
    this.updatedAt = new Date().toISOString();
    return this;
  };

  Booking.prototype.setInProgress = function(odometerReading) {
    this.status = 'in_progress';
    
    // Parse and validate odometer reading
    if (odometerReading !== undefined && odometerReading !== null) {
      const numericReading = parseFloat(odometerReading);
      if (!isNaN(numericReading)) {
        this.initial_odometer_reading = numericReading;
        console.log("[BookingFactory] Set initial odometer reading:", numericReading);
      } else {
        console.warn("[BookingFactory] Invalid odometer reading provided:", odometerReading);
      }
    }
    
    this.trip_start_time = new Date().toISOString();
    this.updatedAt = this.trip_start_time;
    
    // Store in localStorage as a backup
    if (this.booking_id && this.initial_odometer_reading !== null) {
      try {
        localStorage.setItem(`booking_${this.booking_id}_initial_odometer`, this.initial_odometer_reading.toString());
      } catch (e) {
        console.warn("[BookingFactory] Could not save initial odometer to localStorage:", e);
      }
    }
    
    return this;
  };

  Booking.prototype.setCompleted = function(odometerReading, extraCharges) {
    this.status = 'completed';
    
    // Parse and validate final odometer reading
    if (odometerReading !== undefined && odometerReading !== null) {
      const numericReading = parseFloat(odometerReading);
      if (!isNaN(numericReading)) {
        this.final_odometer_reading = numericReading;
        console.log("[BookingFactory] Set final odometer reading:", numericReading);
      } else {
        console.warn("[BookingFactory] Invalid final odometer reading provided:", odometerReading);
      }
    }
    
    // Parse and validate extra charges
    if (extraCharges !== undefined && extraCharges !== null) {
      const numericCharges = parseFloat(extraCharges);
      if (!isNaN(numericCharges)) {
        this.extra_charges = numericCharges;
        console.log("[BookingFactory] Set extra charges:", numericCharges);
      } else {
        console.warn("[BookingFactory] Invalid extra charges provided:", extraCharges);
      }
    }

    this.trip_end_time = new Date().toISOString();
    
    // Try to get initial reading from localStorage if not set
    if (this.initial_odometer_reading === null && this.booking_id) {
      try {
        const storedReading = localStorage.getItem(`booking_${this.booking_id}_initial_odometer`);
        if (storedReading) {
          this.initial_odometer_reading = parseFloat(storedReading);
          console.log("[BookingFactory] Retrieved initial odometer reading from localStorage:", this.initial_odometer_reading);
        }
      } catch (e) {
        console.warn("[BookingFactory] Could not get initial odometer from localStorage:", e);
      }
    }
    
    // Calculate total kilometers if we have both readings
    if (this.initial_odometer_reading !== null && this.final_odometer_reading !== null) {
      this.total_km = this.final_odometer_reading - this.initial_odometer_reading;
      if (this.total_km < 0) this.total_km = 0; // Safety check
      console.log("[BookingFactory] Calculated total km:", this.total_km);
    }
    
    this.updatedAt = this.trip_end_time;
    
    // Clean up localStorage
    if (this.booking_id) {
      try {
        localStorage.removeItem(`booking_${this.booking_id}_initial_odometer`);
      } catch (e) {
        console.warn("[BookingFactory] Could not remove initial odometer from localStorage:", e);
      }
    }
    
    return this;
  };

  Booking.prototype.setCancelled = function(reason) {
    this.status = 'cancelled';
    this.cancellation_reason = reason || this.cancellation_reason;
    this.cancellation_date = new Date().toISOString();
    this.updatedAt = this.cancellation_date;
    return this;
  };

  // Payment status update methods
  Booking.prototype.setPaymentPending = function() {
    this.payment_status = 'pending';
    this.updatedAt = new Date().toISOString();
    return this;
  };

  Booking.prototype.setPaymentPaid = function(paymentId) {
    this.payment_status = 'paid';
    if (paymentId) {
      this.payment_id = paymentId;
    }
    this.updatedAt = new Date().toISOString();
    return this;
  };

  Booking.prototype.setPaymentRefunded = function() {
    this.payment_status = 'refunded';
    this.updatedAt = new Date().toISOString();
    return this;
  };

  Booking.prototype.setPaymentFailed = function() {
    this.payment_status = 'failed';
    this.updatedAt = new Date().toISOString();
    return this;
  };

  // Date and duration methods
  Booking.prototype.getBookingDurationInDays = function() {
    if (!this.booking_start_date || !this.booking_end_date) {
      return 0;
    }
    
    const startDate = new Date(this.booking_start_date);
    const endDate = new Date(this.booking_end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 0;
    }
    
    // Add 1 day to include the end date in the duration
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  Booking.prototype.getFormattedStartDate = function() {
    if (!this.booking_start_date) return 'Not specified';
    return new Date(this.booking_start_date).toLocaleDateString();
  };

  Booking.prototype.getFormattedEndDate = function() {
    if (!this.booking_end_date) return 'Not specified';
    return new Date(this.booking_end_date).toLocaleDateString();
  };

  Booking.prototype.getTripDurationInHours = function() {
    if (!this.trip_start_time || !this.trip_end_time) {
      return 0;
    }
    
    const startTime = new Date(this.trip_start_time);
    const endTime = new Date(this.trip_end_time);
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return 0;
    }
    
    return Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10; // To 1 decimal place
  };

  // Formatting methods
  Booking.prototype.getFormattedTotalPrice = function() {
    return '₹' + (this.total_price || 0).toFixed(2);
  };

  Booking.prototype.getFormattedExtraCharges = function() {
    return '₹' + (this.extra_charges || 0).toFixed(2);
  };

  Booking.prototype.getFormattedFinalPrice = function() {
    const finalPrice = (this.total_price || 0) + (this.extra_charges || 0);
    return '₹' + finalPrice.toFixed(2);
  };

  Booking.prototype.getVehicleTitle = function() {
    return this.vehicle_details && this.vehicle_details.title 
      ? this.vehicle_details.title 
      : 'Vehicle Details Not Available';
  };

  Booking.prototype.getVehicleImage = function() {
    return this.vehicle_details && this.vehicle_details.images && this.vehicle_details.images.length > 0
      ? this.vehicle_details.images[0]
      : 'assets/images/default-car.jpg';
  };

  // Review methods
  Booking.prototype.addReview = function(rating, comment) {
    if (rating < 1 || rating > 5) {
      return false;
    }
    
    this.review = {
      rating: rating,
      comment: comment || '',
      date: new Date().toISOString()
    };
    
    this.updatedAt = this.review.date;
    return true;
  };

  Booking.prototype.hasReview = function() {
    return this.review && this.review.rating !== undefined;
  };

  // Validation methods
  Booking.prototype.validate = function() {
    const errors = [];
    
    // Required fields validation
    if (!this.vehicle) {
      errors.push("Vehicle is required");
    }
    
    if (!this.renter || !this.renter.user) {
      errors.push("Renter information is required");
    }
    
    if (!this.seller || !this.seller.user) {
      errors.push("Seller information is required");
    }
    
    // Date validations
    if (!this.booking_start_date) {
      errors.push("Booking start date is required");
    }
    
    if (!this.booking_end_date) {
      errors.push("Booking end date is required");
    }
    
    // Price validation
    if (this.total_price === undefined || this.total_price === null) {
      errors.push("Total price is required");
    } else if (isNaN(this.total_price)) {
      errors.push("Total price must be a number");
    } else if (this.total_price < 0) {
      errors.push("Total price cannot be negative");
    }
    
    // Extra charges validation
    if (this.extra_charges !== undefined && this.extra_charges !== null) {
      if (isNaN(this.extra_charges)) {
        errors.push("Extra charges must be a number");
      } else if (this.extra_charges < 0) {
        errors.push("Extra charges cannot be negative");
      }
    }
    
    // Compare dates if both are present
    if (this.booking_start_date && this.booking_end_date) {
      const startDate = new Date(this.booking_start_date);
      const endDate = new Date(this.booking_end_date);
      
      if (isNaN(startDate.getTime())) {
        errors.push("Invalid start date format");
      }
      
      if (isNaN(endDate.getTime())) {
        errors.push("Invalid end date format");
      }
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        if (endDate < startDate) {
          errors.push("End date must be after start date");
        }
      }
    }
    
    // Trip time validations
    if (this.trip_start_time && this.trip_end_time) {
      const startTime = new Date(this.trip_start_time);
      const endTime = new Date(this.trip_end_time);
      
      if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
        if (endTime < startTime) {
          errors.push("Trip end time must be after trip start time");
        }
      }
    }
    
    // Odometer readings validation
    if (this.initial_odometer_reading !== null && this.final_odometer_reading !== null) {
      if (isNaN(this.initial_odometer_reading)) {
        errors.push("Initial odometer reading must be a number");
      } else if (this.initial_odometer_reading < 0) {
        errors.push("Initial odometer reading cannot be negative");
      }
      
      if (isNaN(this.final_odometer_reading)) {
        errors.push("Final odometer reading must be a number");
      } else if (this.final_odometer_reading < 0) {
        errors.push("Final odometer reading cannot be negative");
      }
      
      if (!isNaN(this.initial_odometer_reading) && !isNaN(this.final_odometer_reading)) {
        if (this.final_odometer_reading < this.initial_odometer_reading) {
          errors.push("Final odometer reading cannot be less than initial reading");
        }
      }
    }
    
    // Review validation if present
    if (this.review) {
      if (this.review.rating === undefined || this.review.rating === null) {
        errors.push("Review rating is required");
      } else if (isNaN(this.review.rating)) {
        errors.push("Review rating must be a number");
      } else if (this.review.rating < 1 || this.review.rating > 5) {
        errors.push("Review rating must be between 1 and 5");
      }
    }
    
    return errors;
  };

  Booking.prototype.validateStatus = function() {
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'cancelled', 'completed'];
    if (!this.status) {
      return ["Status is required"];
    }
    if (!validStatuses.includes(this.status.toLowerCase())) {
      return [`Invalid status: ${this.status}. Must be one of: ${validStatuses.join(', ')}`];
    }
    return [];
  };

  Booking.prototype.validatePaymentStatus = function() {
    const validStatuses = ['pending', 'paid', 'refunded', 'failed'];
    if (!this.payment_status) {
      return ["Payment status is required"];
    }
    if (!validStatuses.includes(this.payment_status.toLowerCase())) {
      return [`Invalid payment status: ${this.payment_status}. Must be one of: ${validStatuses.join(', ')}`];
    }
    return [];
  };

  // Data transformation for API
  Booking.prototype.toApiData = function() {
    return {
      vehicle: this.vehicle,
      renter: this.renter,
      seller: this.seller,
      booking_start_date: this.booking_start_date,
      booking_end_date: this.booking_end_date,
      is_outstation: this.is_outstation,
      total_price: this.total_price,
      status: this.status,
      payment_status: this.payment_status,
      payment_id: this.payment_id,
      initial_odometer_reading: this.initial_odometer_reading,
      final_odometer_reading: this.final_odometer_reading,
      extra_charges: this.extra_charges,
      cancellation_reason: this.cancellation_reason
    };
  };

  Booking.prototype.toJSON = function() {
    return {
      booking_id: this.booking_id,
      vehicle: this.vehicle,
      vehicle_details: this.vehicle_details,
      bid: this.bid,
      renter: this.renter,
      seller: this.seller,
      booking_start_date: this.booking_start_date,
      booking_end_date: this.booking_end_date,
      is_outstation: this.is_outstation,
      total_price: this.total_price,
      status: this.status,
      payment_status: this.payment_status,
      payment_id: this.payment_id,
      initial_odometer_reading: this.initial_odometer_reading,
      final_odometer_reading: this.final_odometer_reading,
      trip_start_time: this.trip_start_time,
      trip_end_time: this.trip_end_time,
      extra_charges: this.extra_charges,
      total_km: this.total_km,
      cancellation_reason: this.cancellation_reason,
      cancellation_date: this.cancellation_date,
      review: this.review,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };

  // Factory methods
  return {
    createBooking: function(data) {
      return new Booking(data);
    },
    
    createBookingArray: function(bookingsData) {
      return bookingsData.map(function(bookingData) {
        return new Booking(bookingData);
      });
    },
    
    validateBooking: function(bookingData, validationType) {
      const booking = bookingData instanceof Booking ? bookingData : new Booking(bookingData);
      let errors = [];
      
      // Validate based on validation type
      if (validationType === 'status' || validationType === 'full') {
        errors = errors.concat(booking.validateStatus());
      }
      
      if (validationType === 'payment' || validationType === 'full') {
        errors = errors.concat(booking.validatePaymentStatus());
      }
      
      if (validationType === 'creation' || validationType === 'full' || !validationType) {
        errors = errors.concat(booking.validate());
      }
      
      return errors;
    },
    
    validateOdometerReading: function(reading) {
      const errors = [];
      
      if (reading === undefined || reading === null) {
        errors.push("Odometer reading is required");
        return errors;
      }
      
      // Ensure it's a valid number
      const numericReading = parseFloat(reading);
      if (isNaN(numericReading)) {
        errors.push("Odometer reading must be a valid number");
        return errors;
      }
      
      // Prevent negative values
      if (numericReading < 0) {
        errors.push("Odometer reading cannot be negative");
      }
      
      // Check for unreasonably large values (e.g., over 1 million kilometers)
      if (numericReading > 1000000) {
        errors.push("Odometer reading is unreasonably high");
      }
      
      return errors;
    },
    
    validateExtraCharges: function(charges) {
      const errors = [];
      
      if (charges === undefined || charges === null) {
        return errors; // Extra charges are optional
      }
      
      // Ensure it's a valid number
      const numericCharges = parseFloat(charges);
      if (isNaN(numericCharges)) {
        errors.push("Extra charges must be a valid number");
        return errors;
      }
      
      // Prevent negative values
      if (numericCharges < 0) {
        errors.push("Extra charges cannot be negative");
      }
      
      // Check for unreasonably large values
      if (numericCharges > 100000) {
        errors.push("Extra charges amount is unreasonably high");
      }
      
      return errors;
    }
  };
}
