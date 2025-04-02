import { timeGroupStage } from './utils.js';

/**
 * Get vehicle counts by category
 * @returns {Array} MongoDB aggregation pipeline for vehicle counts by category
 */
export const vehiclesByCategoryPipeline = () => {
  return [
    {
      $group: {
        _id: '$category_name',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
};

/**
 * Get vehicle counts by location
 * @returns {Array} MongoDB aggregation pipeline for vehicle counts by location
 */
export const vehiclesByLocationPipeline = () => {
  return [
    {
      $group: {
        _id: '$location',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        location: '$_id',
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
};

/**
 * Get price ranges by category
 * @returns {Array} MongoDB aggregation pipeline for price ranges by category
 */
export const priceRangesByCategoryPipeline = () => {
  return [
    {
      $group: {
        _id: '$category_name',
        minPrice: { $min: '$pricing.basePrice' },
        maxPrice: { $max: '$pricing.basePrice' },
        avgPrice: { $avg: '$pricing.basePrice' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        _id: { $ne: null }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        minPrice: 1,
        maxPrice: 1,
        avgPrice: { $round: ['$avgPrice', 2] },
        priceRange: { $subtract: ['$maxPrice', '$minPrice'] },
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
};

/**
 * Get vehicle listing growth over time
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @param {string} timeUnit - Time unit for grouping (day, week, month, year)
 * @returns {Array} MongoDB aggregation pipeline for vehicle listing growth over time
 */
export const vehicleGrowthOverTimePipeline = (startDate, endDate, timeUnit = 'month') => {
  return [
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    timeGroupStage('createdAt', timeUnit),
    {
      $addFields: {
        dateGroup: {
          $dateFromParts: {
            year: '$_id.year',
            month: { $ifNull: ['$_id.month', 1] },
            day: { $ifNull: ['$_id.day', 1] }
          }
        }
      }
    },
    {
      $group: {
        _id: '$dateGroup',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        newListings: '$count'
      }
    }
  ];
};

