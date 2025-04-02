// src/app/services/validation.service.js

'use strict';
angular
  .module('carRentalApp')
  .service('ValidationService', ValidationService);

function ValidationService() {
  // Exposed service methods
  const service = {
    isValidEmail: isValidEmail,
    isValidUsername: isValidUsername,
    isValidPassword: isValidPassword,
    passwordsMatch: passwordsMatch,
    isNonEmptyString: isNonEmptyString,
    isValidDate: isValidDate,
    isValidDateRange: isValidDateRange,
    isDateInFuture: isDateInFuture,
    validateAnalyticsDates: validateAnalyticsDates
  };
  
  return service;
  
  /**
   * Validates email format using regex
   * @param {string} email - Email to validate
   * @returns {boolean} True if email format is valid
   */
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  /**
   * Validates username format (3-20 characters, alphanumeric + underscore)
   * @param {string} username - Username to validate
   * @returns {boolean} True if username format is valid
   */
  function isValidUsername(username) {
    const re = /^[A-Za-z0-9_]{3,20}$/;
    return re.test(username);
  }
  
  /**
   * Validates password strength (at least 6 chars, 1 uppercase, 1 digit, 1 special char)
   * @param {string} password - Password to validate
   * @returns {boolean} True if password meets security requirements
   */
  function isValidPassword(password) {
    const re = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;
    return re.test(password);
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
   * Checks if string is not empty after trimming
   * @param {string} str - String to check
   * @returns {boolean} True if string is not empty
   */
  function isNonEmptyString(str) {
    return typeof str === 'string' && str.trim().length > 0;
  }

  /**
   * Validates if a date string or object is a valid date
   * @param {string|Date} date - Date to validate
   * @returns {boolean} True if date is valid
   */
  function isValidDate(date) {
    if (!date) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  }

  /**
   * Validates if end date is after start date
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {boolean} True if dates form a valid range
   */
  function isValidDateRange(startDate, endDate) {
    if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
    return new Date(endDate) > new Date(startDate);
  }

  /**
   * Checks if a date is in the future
   * @param {string|Date} date - Date to check
   * @returns {boolean} True if date is in the future
   */
  function isDateInFuture(date) {
    if (!isValidDate(date)) return false;
    return new Date(date) > new Date();
  }

  /**
   * Validates dates for analytics
   * @param {Object} params - Date parameters
   * @param {string|Date} params.startDate - Start date
   * @param {string|Date} params.endDate - End date
   * @returns {Object} Validation result with isValid and error properties
   */
  function validateAnalyticsDates(params) {
    const result = { isValid: true, error: null };
    
    // If either date is provided, both must be provided
    if ((params.startDate && !params.endDate) || (!params.startDate && params.endDate)) {
      result.isValid = false;
      result.error = 'Both start date and end date must be provided';
      return result;
    }
    
    // If no dates provided, that's valid (will use default date range)
    if (!params.startDate && !params.endDate) {
      return result;
    }
    
    // Validate date formats
    if (!isValidDate(params.startDate) || !isValidDate(params.endDate)) {
      result.isValid = false;
      result.error = 'Invalid date format';
      return result;
    }
    
    // Validate date range
    if (!isValidDateRange(params.startDate, params.endDate)) {
      result.isValid = false;
      result.error = 'End date must be after start date';
      return result;
    }
    
    // For analytics, end date cannot be in the future
    if (isDateInFuture(params.endDate)) {
      result.isValid = false;
      result.error = 'End date cannot be in the future for analytics';
      return result;
    }
    
    return result;
  }
}
