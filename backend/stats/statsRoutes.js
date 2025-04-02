import express, { Router } from 'express';
import {
  getUserStats,
  getBookingStats,
  getBiddingStats,
  getVehicleStats,
  getDashboardStats
} from './statsController.js';
import {authenticate} from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/role.middleware.js';


const router = Router();

// Apply both middleware to all stats routes
// First authenticate the user, then check if they're an admin
router.use(authenticate, isAdmin);

/**
 * @route     GET /api/v1/stats/dashboard
 * @desc      Get dashboard statistics overview
 * @access    Private/Admin
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/dashboard', getDashboardStats);

/**
 * @route     GET /api/v1/stats/users
 * @desc      Get user statistics
 * @access    Private/Admin
 * @query     startDate - Start date for time-based stats (optional)
 * @query     endDate - End date for time-based stats (optional)
 * @query     timeUnit - Time unit for grouping (day, week, month, year)
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/users', getUserStats);

/**
 * @route     GET /api/v1/stats/bookings
 * @desc      Get booking statistics
 * @access    Private/Admin
 * @query     startDate - Start date for time-based stats (optional)
 * @query     endDate - End date for time-based stats (optional)
 * @query     timeUnit - Time unit for grouping (day, week, month, year)
 * @query     limit - Limit for top items lists (default: 10)
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/bookings', getBookingStats);

/**
 * @route     GET /api/v1/stats/biddings
 * @desc      Get bidding statistics
 * @access    Private/Admin
 * @query     limit - Limit for top items lists (default: 10)
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/biddings', getBiddingStats);

/**
 * @route     GET /api/v1/stats/vehicles
 * @desc      Get vehicle statistics
 * @access    Private/Admin
 * @query     startDate - Start date for time-based stats (optional)
 * @query     endDate - End date for time-based stats (optional)
 * @query     timeUnit - Time unit for grouping (day, week, month, year)
 * @query     inactiveSince - Date to check for inactive vehicles since (optional)
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/vehicles', getVehicleStats);

export default router; 