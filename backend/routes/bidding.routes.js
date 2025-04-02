import { Router } from 'express';
import { 
  placeBid, 
  getUserBids, 
  getVehicleBids, 
  getSellerBids, 
  respondToBid,
  getBidById,
  cancelBid,
  getHighestBid
} from '../controllers/bidding.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// ========= Bidding Routes =========

/**
 * @route     POST /api/v1/bids
 * @desc      Place a new bid on a vehicle
 * @access    Private
 * @params    None
 * @body      {
 *              vehicleId: ObjectId,
 *              bidAmount: Number,
 *              bookingStartDate: Date,
 *              bookingEndDate: Date,
 *              isOutstation: Boolean,
 *              bidMessage: String
 *            }
 * @returns   {success: Boolean, message: String, data: Object}
 * 
 * This route allows users to place bids on vehicles they want to rent.
 * The system validates that:
 * - The vehicle exists and is available
 * - The user is not the owner of the vehicle
 * - The bid amount meets minimum requirements
 */
router.route('/').post(authenticate, placeBid);

/**
 * @route     GET /api/v1/bids/user
 * @desc      Get all bids placed by the current user
 * @access    Private
 * @params    None
 * @body      None
 * @returns   {success: Boolean, count: Number, data: Array}
 * 
 * This route returns all bids the user has placed, sorted by most recent first.
 * It includes all bids regardless of status (pending, accepted, rejected, etc.)
 */
router.route('/user').get(authenticate, getUserBids);

/**
 * @route     GET /api/v1/bids/vehicle/:vehicleId
 * @desc      Get all bids for a specific vehicle
 * @access    Private (vehicle owner only)
 * @params    vehicleId: ObjectId
 * @body      None
 * @returns   {success: Boolean, count: Number, data: Array}
 * 
 * This route allows vehicle owners to view all bids on their vehicles.
 * The controller verifies that the authenticated user owns the specified vehicle.
 */
router.route('/vehicle/:vehicleId').get(authenticate, getVehicleBids);

/**
 * @route     GET /api/v1/bids/seller
 * @desc      Get all bids for all vehicles owned by current user
 * @access    Private
 * @params    None
 * @body      None
 * @returns   {success: Boolean, count: Number, data: Array}
 * 
 * This route aggregates all bids across all vehicles owned by the user.
 * It first finds all vehicles owned by the user, then retrieves all bids for those vehicles.
 */
router.route('/seller').get(authenticate, getSellerBids);

/**
 * @route     GET /api/v1/bids/:bidId
 * @desc      Get a specific bid by ID
 * @access    Private (bid owner or vehicle owner only)
 * @params    bidId: ObjectId
 * @body      None
 * @returns   {success: Boolean, data: Object}
 * 
 * This route returns detailed information about a specific bid.
 * The controller verifies that the user is either the one who placed the bid
 * or the owner of the vehicle the bid was placed on.
 */
router.route('/:bidId').get(authenticate, getBidById);

/**
 * @route     POST /api/v1/bids/:bidId/respond
 * @desc      Respond to a bid (accept/reject)
 * @access    Private (vehicle owner only)
 * @params    bidId: ObjectId
 * @body      {
 *              response: String ('accepted' or 'rejected'),
 *              responseMessage: String
 *            }
 * @returns   {success: Boolean, message: String, data: Object}
 * 
 * This route allows vehicle owners to accept or reject bids on their vehicles.
 * The controller verifies:
 * - The user is the owner of the vehicle the bid was placed on
 * - The bid is still in "pending" status
 * - If accepting, the bid doesn't conflict with other accepted bids
 */
router.route('/:bidId/respond').post(authenticate, respondToBid);

/**
 * @route     POST /api/v1/bids/:bidId/cancel
 * @desc      Cancel a pending bid
 * @access    Private (bid owner only)
 * @params    bidId: ObjectId
 * @body      None
 * @returns   {success: Boolean, message: String, data: Object}
 * 
 * This route allows users to cancel their own bids.
 * The controller verifies:
 * - The user is the one who placed the bid
 * - The bid is still in "pending" status
 * - The booking start time is more than 24 hours away
 */
router.route('/:bidId/cancel').post(authenticate, cancelBid);

/**
 * @route     GET /api/v1/bids/highest/:vehicleId
 * @desc      Get the highest bid amount for a specific vehicle
 * @access    Public
 * @params    vehicleId: ObjectId
 * @body      None
 * @returns   {success: Boolean, data: { highestBid: Number|null }}
 * 
 * This route returns the highest bid amount for a specific vehicle.
 * If no bids exist, it returns null as the highest bid.
 */
router.route('/highest/:vehicleId').get(getHighestBid);

export default router; 