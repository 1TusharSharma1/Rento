import { timeGroupStage } from './utils.js';

/**
 * Get user count by role
 * @returns {Array} MongoDB aggregation pipeline for user count by role
 */
export const usersByRolePipeline = () => {
  return [
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        role: '$_id',
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
};

/**
 * Get new user signups over time
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @param {string} timeUnit - Time unit for grouping (day, week, month, year)
 * @returns {Array} MongoDB aggregation pipeline for new user signups over time
 */
export const newUsersOverTimePipeline = (startDate, endDate, timeUnit = 'day') => {
  return [
    {
      $sort: { createdAt: 1 }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" }
        },
        count: { $sum: 1 },
        users: { $push: { 
          id: '$_id', 
          email: '$email',
          role: '$role',
          createdAt: '$createdAt' 
        }}
      }
    },
    {
      $addFields: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        date: 1,
        count: 1,
        users: 1
      }
    },
    {
      $sort: { date: 1 }
    }
  ];
};

/**
 * Get user retention rate (users who booked more than once)
 * @param {Date} startDate - Start date for the range
 * @param {Date} endDate - End date for the range
 * @returns {Array} MongoDB aggregation pipeline for user retention
 */
export const userRetentionPipeline = (startDate, endDate) => {
  return [
    {
      $group: {
        _id: '$renter.user',
        bookingCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        usersWithOneBooking: {
          $sum: { $cond: [{ $eq: ['$bookingCount', 1] }, 1, 0] }
        },
        usersWithMultipleBookings: {
          $sum: { $cond: [{ $gt: ['$bookingCount', 1] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalUsers: 1,
        usersWithOneBooking: 1,
        usersWithMultipleBookings: 1,
        retentionRate: {
          $cond: [
            { $eq: ['$totalUsers', 0] },
            0,
            {
              $multiply: [
                {
                  $divide: ['$usersWithMultipleBookings', '$totalUsers']
                },
                100
              ]
            }
          ]
        }
      }
    }
  ];
}; 