import mongoose from 'mongoose';
import ApiError from './ApiError.js';

/**
 * Validates MongoDB Object ID
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {boolean} - True if valid
 * @throws {ApiError} - If ID is invalid
 */
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${fieldName} format`);
  }
  return true;
};

/**
 * Validates required fields in a request body
 * @param {Object} body - Request body
 * @param {Array} fields - Array of field names to check
 * @throws {ApiError} - If any field is missing
 */
export const validateRequiredFields = (body, fields) => {
  const missingFields = fields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    throw new ApiError(
      400, 
      `Missing required fields: ${missingFields.join(', ')}`
    );
  }
};

/**
 * Validates that a number is positive
 * @param {number} value - The number to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @throws {ApiError} - If number is invalid
 */
export const validatePositiveNumber = (value, fieldName) => {
  if (isNaN(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive number`);
  }
};

/**
 * Validates date fields
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {boolean} allowPastDates - Whether to allow dates in the past
 * @throws {ApiError} - If dates are invalid
 */
export const validateDateRange = (startDate, endDate, allowPastDates = false) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }
  if (end <= start) {
    throw new ApiError(400, 'End date must be after start date');
  }
};

/**
 * Validates authorization for an entity
 * @param {Object} entity - Entity with user/owner reference
 * @param {Object} user - Authenticated user
 * @param {string} userField - Path to user ID in entity (e.g., 'seller.user')
 * @param {string} action - Action being performed (for error message)
 * @throws {ApiError} - If user is not authorized
 */
export const validateAuthorization = (entity, user, userField, action) => {
  // Split the path and traverse the object
  const path = userField.split('.');
  let reference = entity;
  
  for (const key of path) {
    reference = reference[key];
  }
  
  // Convert to string for comparison
  const entityUserId = reference.toString();
  const requestUserId = user._id.toString();
  
  if (entityUserId !== requestUserId) {
    throw new ApiError(403, `You are not authorized to ${action}`);
  }
  
  return true;
};

/**
 * Validates enum values
 * @param {string} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field (for error message)
 * @throws {ApiError} - If value is not in allowed values
 */
export const validateEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    throw new ApiError(
      400, 
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`
    );
  }
};

/**
 * Performs validation for bidding requests
 * @param {Object} bidData - Bid data to validate
 */
export const validateBidData = ({ vehicleId, bidAmount, bookingStartDate, bookingEndDate }) => {
  validateObjectId(vehicleId, 'vehicle ID');
  validatePositiveNumber(bidAmount, 'Bid amount');
  
  if (!bookingStartDate || !bookingEndDate) {
    throw new ApiError(400, 'Both start and end dates are required');
  }
  
  validateDateRange(bookingStartDate, bookingEndDate);
};

/**
 * Validates booking status transition
 * @param {string} currentStatus - Current status of booking
 * @param {string} newStatus - New status being set
 * @param {string} action - Action being performed
 * @throws {ApiError} - If transition is invalid
 */
export const validateStatusTransition = (currentStatus, newStatus, action) => {
  // Define valid transitions
  const validTransitions = {
    'pending': ['confirmed', 'in_progress', 'cancelled'],
    'confirmed': ['in_progress', 'cancelled'],
    'in_progress': ['completed', 'cancelled']
  };
  
  // If same status, it's valid (no change)
  if (currentStatus === newStatus) {
    return;
  }
  
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    throw new ApiError(400, `Cannot ${action || 'change'} a booking with status '${currentStatus}' to '${newStatus}'`);
  }
}; 