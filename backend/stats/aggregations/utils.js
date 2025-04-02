// Common utility functions for aggregation pipelines

/**
 * Create date range stages for time-based aggregation
 * @param {string} dateField - The date field to filter on
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @returns {Object} MongoDB aggregation stage for date filtering
 */
export const dateRangeStage = (dateField, startDate, endDate) => {
  const matchStage = { $match: {} };
  matchStage.$match[dateField] = {};
  
  if (startDate) {
    matchStage.$match[dateField].$gte = new Date(startDate);
  }
  if (endDate) {
    matchStage.$match[dateField].$lte = new Date(endDate);
  }
  
  return matchStage;
};

/**
 * Create time grouping stages (by day, week, month, year)
 * @param {string} dateField - The date field to group by
 * @param {string} timeUnit - Time unit for grouping (day, week, month, year)
 * @returns {Object} MongoDB aggregation stage for time grouping
 */
export const timeGroupStage = (dateField, timeUnit) => {
  const groupStage = { $group: { _id: {} } };
  
  switch (timeUnit) {
    case 'day':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` },
        day: { $dayOfMonth: `$${dateField}` }
      };
      break;
    case 'week':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` },
        day: { 
          $subtract: [
            { $dayOfMonth: `$${dateField}` },
            { $mod: [{ $dayOfMonth: `$${dateField}` }, 7] }
          ]
        }
      };
      break;
    case 'month':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` }
      };
      break;
    case 'year':
      groupStage.$group._id = {
        year: { $year: `$${dateField}` }
      };
      break;
    default:
      groupStage.$group._id = {
        year: { $year: `$${dateField}` },
        month: { $month: `$${dateField}` },
        day: { $dayOfMonth: `$${dateField}` }
      };
  }
  
  return groupStage;
};

/**
 * Calculate date difference in days
 * @param {string} startDateField - Start date field
 * @param {string} endDateField - End date field 
 * @returns {Object} MongoDB aggregation expression for date difference in days
 */
export const dateDiffDays = (startDateField, endDateField) => {
  return {
    $divide: [
      { $subtract: [`$${endDateField}`, `$${startDateField}`] },
      1000 * 60 * 60 * 24 // Convert milliseconds to days
    ]
  };
}; 