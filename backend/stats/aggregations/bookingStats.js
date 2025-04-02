import { dateDiffDays } from './utils.js';

/**
 * Get booking counts by status
 * @returns {Array} MongoDB aggregation pipeline for booking counts by status
 */
export const bookingsByStatusPipeline = () => {
  return [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
};

export const revenuesOverTimePipeline = (startDate, endDate, timeUnit = 'month') => {
  return [
    {
      $match: {
        booking_start_date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: 'completed'
      }
    },
    {
      $addFields: {
        totalAmount: { $add: ['$total_price', { $ifNull: ['$extra_charges', 0] }] }
      }
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: "$booking_start_date",
            unit: timeUnit
          }
        },
        revenue: { $sum: "$totalAmount" },
        bookingCount: { $sum: 1 },
        averageRevenue: { $avg: "$totalAmount" }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        revenue: 1,
        bookingCount: 1,
        averageRevenue: 1
      }
    }
  ];
};


export const outstationVsLocalPipeline = () => {
  return [
    {
      $addFields: {
        totalAmount: {
          $add: ['$total_price', { $ifNull: ['$extra_charges', 0] }]
        }
      }
    },
    {
      $group: {
        _id: { is_outstation: '$is_outstation' },
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        bookings: { $push: '$$ROOT' }
      }
    },
    {
      $project: {
        _id: 0,
        is_outstation: '$_id.is_outstation',
        count: 1,
        revenue: 1,
        avgBookingValue: { $divide: ['$revenue', '$count'] },
        avgDuration: {
          $avg: {
            $map: {
              input: '$bookings',
              as: 'booking',
              in: {
                $add: [
                  {
                    $dateDiff: {
                      startDate: "$$booking.booking_start_date",
                      endDate: "$$booking.booking_end_date",
                      unit: "day"
                    }
                  },
                  1
                ]
              }
            }
          }
        }
      }
    }
  ];
};


/**
 * Get top performing vehicles by booking count
 * @param {number} limit - Number of vehicles to return
 * @returns {Array} MongoDB aggregation pipeline for top performing vehicles
 */
export const topPerformingVehiclesPipeline = (limit = 10) => {
  return [
    {
      $addFields: {
        totalAmount: { $add: ['$total_price', { $ifNull: ['$extra_charges', 0] }] }
      }
    },
    {
      $group: {
        _id: '$vehicle',
        bookingCount: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        vehicleDetails: { $first: '$vehicle_details' }
      }
    },
    {
      $project: {
        _id: 0,
        vehicleId: '$_id',
        title: '$vehicleDetails.title',
        category: '$vehicleDetails.category_details.name',
        bookingCount: 1,
        totalRevenue: 1,
        averageBookingValue: { $divide: ['$totalRevenue', '$bookingCount'] }
      }
    },
    {
      $sort: { bookingCount: -1 }
    },
    {
      $limit: limit
    }
  ];
}; 