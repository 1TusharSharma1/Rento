import express from 'express';
import {
  convertBidToBooking,
  getRenterBookings,
  getSellerBookings,
  getBookingById,
  cancelBooking,
  completeBooking,
  updateBookingStatus,
  updateBooking
} from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply JWT verification to all routes
router.use(authenticate);

// Convert bid to booking
router.post('/convert-bid/:bidId', convertBidToBooking);

// Get bookings for renter
router.get('/renter', getRenterBookings);

// Get bookings for seller
router.get('/seller', getSellerBookings);

// Get specific booking
router.get('/:bookingId', getBookingById);

// Update booking
router.put('/:bookingId', updateBooking);

// Update booking status
router.patch('/:bookingId/status', updateBookingStatus);

// Cancel booking
router.post('/:bookingId/cancel', cancelBooking);

// Complete booking
router.post('/:bookingId/complete', completeBooking);

export default router; 