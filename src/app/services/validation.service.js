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
    isNonEmptyString: isNonEmptyString
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
}
