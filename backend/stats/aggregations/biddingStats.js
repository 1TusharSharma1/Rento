/**
 * Get bid counts by status
 * @returns {Array} MongoDB aggregation pipeline for bid counts by status
 */
export const bidsByStatusPipeline = () => {
  return [
    {
      $group: {
        _id: '$bid_status',
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

/**
 * Get bid conversion rate (accepted bids that converted to bookings)
 * @returns {Array} MongoDB aggregation pipeline for bid conversion rate
 */
export const bidConversionRatePipeline = () => {
  return [
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        accepted: {
          $sum: {
            $cond: [{ $eq: ['$bid_status', 'accepted'] }, 1, 0]
          }
        },
        converted: {
          $sum: {
            $cond: [{ $eq: ['$bid_status', 'converted'] }, 1, 0]
          }
        },
        rejected: {
          $sum: {
            $cond: [{ $eq: ['$bid_status', 'rejected'] }, 1, 0]
          }
        },
        expired: {
          $sum: {
            $cond: [{ $eq: ['$bid_status', 'expired'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        accepted: 1,
        converted: 1,
        rejected: 1,
        expired: 1,
        acceptanceRate: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            {
              $multiply: [
                { $divide: ['$accepted', '$total'] },
                100
              ]
            }
          ]
        },
        conversionRate: {
          $cond: [
            { $eq: ['$accepted', 0] },
            0,
            {
              $multiply: [
                { $divide: ['$converted', '$accepted'] },
                100
              ]
            }
          ]
        },
        rejectionRate: {
          $cond: [
            { $eq: ['$total', 0] },
            0,
            {
              $multiply: [
                { $divide: ['$rejected', '$total'] },
                100
              ]
            }
          ]
        }
      }
    }
  ];
};

/**
 * Get bid distribution by time of day
 * @returns {Array} MongoDB aggregation pipeline for bid distribution by time of day
 */
export const bidsByTimeOfDayPipeline = () => {
  return [
    {
      $addFields: {
        hour: { $hour: '$bid_date' }
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        hour: '$_id',
        count: 1
      }
    },
    {
      $sort: { hour: 1 }
    }
  ];
};

/**
 * Get most bidded vehicles 
 * @param {number} limit - Number of top vehicles to return
 * @returns {Array} MongoDB aggregation pipeline for most bidded vehicles
 */
export const mostBiddedVehiclesPipeline = (limit = 10) => {
  return [
    {
      $group: {
        _id: '$vehicle',
        bidCount: { $sum: 1 },
        avgBidAmount: { $avg: '$bid_amount' },
        vehicleDetails: { $first: '$vehicle_details' }
      }
    },
    {
      $project: {
        _id: 0,
        vehicleId: '$_id',
        title: '$vehicleDetails.title',
        category: '$vehicleDetails.category_name',
        bidCount: 1,
        avgBidAmount: 1,
        basePrice: '$vehicleDetails.pricing.basePrice',
        bidVsBaseRatio: {
          $cond: [
            { $eq: ['$vehicleDetails.pricing.basePrice', 0] },
            null,
            { $divide: ['$avgBidAmount', '$vehicleDetails.pricing.basePrice'] }
          ]
        }
      }
    },
    {
      $sort: { bidCount: -1 }
    },
    {
      $limit: limit
    }
  ];
}; 