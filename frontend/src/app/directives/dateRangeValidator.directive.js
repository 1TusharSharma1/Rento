'use strict';

angular
  .module('carRentalApp')
  .directive('dateRangeValidator', dateRangeValidator);

/**
 * Custom directive for validating date ranges
 * Works with UI Bootstrap datepicker
 */
function dateRangeValidator() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attrs, ngModelCtrl) {
      // Add validator to the model controller
      ngModelCtrl.$validators.dateRangeValid = function(modelValue) {
        // Skip validation if the field is empty
        if (!modelValue) {
          return true;
        }
        
        const dateType = attrs.dateRangeValidator;
        const startDateValue = scope.$eval(attrs.startDate);
        const endDateValue = scope.$eval(attrs.endDate);
        
        // Set the appropriate date based on which field we're validating
        const startDate = dateType === 'start' ? modelValue : startDateValue;
        const endDate = dateType === 'end' ? modelValue : endDateValue;
        
        // Skip validation if the other date is missing
        if (dateType === 'start' && !endDate) return true;
        if (dateType === 'end' && !startDate) return true;
        
        // Convert to Date objects for comparison
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const today = new Date();
        
        // Reset time components for accurate date comparison
        today.setHours(0, 0, 0, 0);
        startDateObj.setHours(0, 0, 0, 0);
        endDateObj.setHours(0, 0, 0, 0);
        
        // Validate based on which field we're checking
        if (dateType === 'start') {
          // Start date must be today or later
          return startDateObj >= today;
        } else if (dateType === 'end') {
          // End date must be at least the same as start date
          return endDateObj >= startDateObj;
        }
        
        return true;
      };
      
      // Watch for changes in the related date to trigger validation
      scope.$watch(attrs.startDate, function() {
        ngModelCtrl.$validate();
      });
      
      scope.$watch(attrs.endDate, function() {
        ngModelCtrl.$validate();
      });
    }
  };
} 