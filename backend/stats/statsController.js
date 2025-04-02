import { User } from '../models/user.model.js';
import { Vehicle } from '../models/vehicle.model.js';
import { Booking, Bidding } from '../models/booking.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { validateDateRange } from '../utils/validations.js';
import * as Aggregations from './aggregations/index.js';

/**
 * Validate date range for statistics
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @throws {ApiError} - If dates are invalid
 */
const validateStatsDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    throw new ApiError(400, 'Both start date and end date are required for time-based statistics');
  }

  // Validate date format and that end date is after start date
  validateDateRange(startDate, endDate, true);
  
  // Additionally validate that end date is not in the future
  const endDateObj = new Date(endDate);
  const now = new Date();
  
  if (endDateObj > now) {
    throw new ApiError(400, 'End date cannot be in the future for statistics');
  }
};

/**
 * Get user statistics
 * @route GET /api/v1/stats/users
 * @access Private/Admin
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, timeUnit = 'month' } = req.query;
  
  // Validate dates if both are provided
  if (startDate && endDate) {
    validateStatsDateRange(startDate, endDate);
  }
  
  // Use Promise.all to run queries concurrently
  const [usersByRole, activeUsers, userRetention, userGrowth] = await Promise.all([
    // User counts by role
    User.aggregate(Aggregations.userStats.usersByRolePipeline()),
    
    
    // User retention rate
    startDate && endDate
      ? Booking.aggregate(Aggregations.userStats.userRetentionPipeline(startDate, endDate))
      : [],
    
    // New users over time
    startDate && endDate
      ? User.aggregate(Aggregations.userStats.newUsersOverTimePipeline(startDate, endDate, timeUnit))
      : []
  ]);
  
  return res.status(200).json(
    new ApiResponse(200, {
      usersByRole,
      activeUsers,
      userRetention: userRetention[0] || {},
      userGrowth
    }, 'User statistics retrieved successfully')
  );
});

/**
 * Get booking statistics
 * @route GET /api/v1/stats/bookings
 * @access Private/Admin
 */
export const getBookingStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, timeUnit = 'month', limit = 10 } = req.query;
  
  // Validate dates if both are provided
  if (startDate && endDate) {
    validateStatsDateRange(startDate, endDate);
  }
  
  // Use Promise.all to run queries concurrently
  const [
    bookingsByStatus, 
    revenueOverTime, 
    outstationVsLocal,
    topVehicles
  ] = await Promise.all([
    // Booking counts by status
    Booking.aggregate(Aggregations.bookingStats.bookingsByStatusPipeline()),
    
    // Revenue over time
    startDate && endDate
      ? Booking.aggregate(Aggregations.bookingStats.revenuesOverTimePipeline(startDate, endDate, timeUnit))
      : [],
    
    // Outstation vs local bookings
    Booking.aggregate(Aggregations.bookingStats.outstationVsLocalPipeline()),
    
    // Top performing vehicles
    Booking.aggregate(Aggregations.bookingStats.topPerformingVehiclesPipeline(parseInt(limit)))
  ]);
  
  return res.status(200).json(
    new ApiResponse(200, {
      bookingsByStatus,
      revenueOverTime,
      outstationVsLocal,
      topVehicles
    }, 'Booking statistics retrieved successfully')
  );
});

/**
 * Get bidding statistics
 * @route GET /api/v1/stats/biddings
 * @access Private/Admin
 */
export const getBiddingStats = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  // Use Promise.all to run queries concurrently
  const [
    bidsByStatus,
    conversionRate,
    bidsByTimeOfDay,
    mostBiddedVehicles
  ] = await Promise.all([
    // Bid counts by status
    Bidding.aggregate(Aggregations.biddingStats.bidsByStatusPipeline()),
    
    // Bid conversion rate
    Bidding.aggregate(Aggregations.biddingStats.bidConversionRatePipeline()),
    
    // Bid distribution by time of day
    Bidding.aggregate(Aggregations.biddingStats.bidsByTimeOfDayPipeline()),
    
    // Most bidded vehicles
    Bidding.aggregate(Aggregations.biddingStats.mostBiddedVehiclesPipeline(parseInt(limit)))
  ]);
  
  return res.status(200).json(
    new ApiResponse(200, {
      bidsByStatus,
      conversionRate: conversionRate[0] || {},
      bidsByTimeOfDay,
      mostBiddedVehicles
    }, 'Bidding statistics retrieved successfully')
  );
});

/**
 * Get vehicle statistics
 * @route GET /api/v1/stats/vehicles
 * @access Private/Admin
 */
export const getVehicleStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, timeUnit = 'month', inactiveSince } = req.query;
  
  // Validate dates if both are provided
  if (startDate && endDate) {
    validateStatsDateRange(startDate, endDate);
  }
  
  // Use Promise.all to run queries concurrently
  const [
    vehiclesByCategory,
    vehiclesByLocation,
    priceRangesByCategory,
    vehicleGrowth,
    inactiveVehicles
  ] = await Promise.all([
    // Vehicle counts by category
    Vehicle.aggregate(Aggregations.vehicleStats.vehiclesByCategoryPipeline()),
    
    // Vehicle counts by location
    Vehicle.aggregate(Aggregations.vehicleStats.vehiclesByLocationPipeline()),
    
    // Price ranges by category
    Vehicle.aggregate(Aggregations.vehicleStats.priceRangesByCategoryPipeline()),
    
    // Vehicle listing growth over time
    startDate && endDate
      ? Vehicle.aggregate(Aggregations.vehicleStats.vehicleGrowthOverTimePipeline(startDate, endDate, timeUnit))
      : []
  ]);
  
  return res.status(200).json(
    new ApiResponse(200, {
      vehiclesByCategory,
      vehiclesByLocation,
      priceRangesByCategory,
      vehicleGrowth,
      inactiveVehicles
    }, 'Vehicle statistics retrieved successfully')
  );
});

/**
 * Get dashboard overview statistics
 * @route GET /api/v1/stats/dashboard
 * @access Private/Admin
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get counts
  const [
    totalUsers,
    totalVehicles,
    totalBookings,
    totalBids,
    totalRevenue,
    recentUsers,
    recentBookings
  ] = await Promise.all([
    User.countDocuments(),
    Vehicle.countDocuments({ status: { $ne: 'deleted' } }),
    Booking.countDocuments(),
    Bidding.countDocuments(),
    Booking.aggregate([
      {
        $match: {
          status: 'completed',
          $or: [
            { payment_status: 'paid' },
            { payment_status: 'pending' }
          ]
        }
      },
      {
        $addFields: {
          totalAmount: { $add: ['$total_price', { $ifNull: ['$extra_charges', 0] }] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]),
    
    // Get recent users - last 7 days
    User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }),
    
    // Get recent bookings - last 7 days
    Booking.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
  ]);
  
  return res.status(200).json(
    new ApiResponse(200, {
      counts: {
        users: totalUsers,
        vehicles: totalVehicles,
        bookings: totalBookings,
        bids: totalBids,
        revenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0
      },
      recent: {
        newUsers: recentUsers,
        newBookings: recentBookings
      }
    }, 'Dashboard statistics retrieved successfully')
  );
}); 