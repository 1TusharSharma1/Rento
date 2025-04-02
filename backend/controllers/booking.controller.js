import mongoose from 'mongoose';
import { Booking, Bidding } from '../models/booking.model.js';
import { Vehicle } from '../models/vehicle.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  validateObjectId,
  validateAuthorization,
  validateStatusTransition,
  validatePositiveNumber
} from '../utils/validations.js';
import { sendBookingConfirmationEmails } from '../utils/email.util.js';

/**
 * Convert an accepted bid to a booking
 * @route POST /api/v1/bookings/convert-bid/:bidId
 * @access Private (only vehicle owner)
 */
export const convertBidToBooking = asyncHandler(async (req, res, next) => {
  const { bidId } = req.params;

  try {
    // Validate bid ID
    validateObjectId(bidId, 'bid ID');

    // Find the bid
    const bid = await Bidding.findById(bidId);
    if (!bid) {
      throw new ApiError(404, 'Bid not found');
    }

    // Check if user is the seller
    validateAuthorization(bid, req.user, 'seller.user', 'convert this bid');

    // Check bid status and handle different cases
    if (bid.bid_status === 'converted') {
      throw new ApiError(400, 'Bid has already been converted to a booking');
    } 
    
    if (bid.bid_status === 'rejected' || bid.bid_status === 'expired') {
      throw new ApiError(400, `Cannot convert a ${bid.bid_status} bid to booking`);
    }

    // If bid is not yet accepted, accept it first
    if (bid.bid_status !== 'accepted') {
      bid.bid_status = 'accepted';
      bid.response_message = 'Bid accepted by seller';
      bid.response_date = new Date();
      await bid.save();
    }

    // Create new booking from bid
    const newBooking = new Booking({
      vehicle: bid.vehicle,
      vehicle_details: bid.vehicle_details,
      bid: bid._id,
      renter: {
        user: bid.bidder.user,
        name: bid.bidder.name,
        email: bid.bidder.email,
        phone: bid.bidder.phone || ''
      },
      seller: {
        user: bid.seller.user,
        name: bid.seller.name,
        email: bid.seller.email,
        phone: bid.seller.phone || ''
      },
      booking_start_date: bid.booking_start_date,
      booking_end_date: bid.booking_end_date,
      is_outstation: bid.is_outstation,
      total_price: bid.bid_amount,
      status: 'pending',
      payment_status: 'pending'
    });

    // Start a transaction for multiple DB operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update bid status to converted
      bid.bid_status = 'converted';
      await bid.save({ session });

      // Save the new booking
      await newBooking.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      // Send confirmation emails (non-blocking)
      sendBookingConfirmationEmails(newBooking).catch(err => {
        console.error('Error sending booking confirmation emails:', err);
        // Continue with response regardless of email sending status
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }

    res.status(201).json({
      success: true,
      message: 'Bid successfully converted to booking',
      data: newBooking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all bookings for the authenticated user (as renter)
 * @route GET /api/v1/bookings/renter
 * @access Private
 */
export const getRenterBookings = asyncHandler(async (req, res, next) => {
  // Read status from query parameters
  const status = req.query.status;

  // Build query object
  const query = { 'renter.user': req.user._id };

  // Add status filter if provided
  if (status) {
    query.status = status;
  }

  // Find bookings based on the constructed query
  const bookings = await Booking.find(query)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings
  });
});

/**
 * Get all bookings for vehicles owned by the authenticated user (as seller)
 * @route GET /api/v1/bookings/seller
 * @access Private
 */
export const getSellerBookings = asyncHandler(async (req, res, next) => {
  // Parse query parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const status = req.query.status;
  
  // Calculate skip for pagination
  const skip = (page - 1) * limit;
  
  // Build query
  const query = { 'seller.user': req.user._id };
  
  // Add status filter if provided
  if (status) {
    query.status = status;
  }
  
  // Count total documents for this query (for pagination metadata)
  const total = await Booking.countDocuments(query);
  
  // Execute query with pagination
  const bookings = await Booking.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  res.status(200).json({
    success: true,
    count: bookings.length,
    total: total,
    pagination: {
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage
    },
    data: bookings
  });
});

/**
 * Get a specific booking by ID
 * @route GET /api/v1/bookings/:bookingId
 * @access Private (only booking participants)
 */
export const getBookingById = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;

  try {
    // Validate booking ID
    validateObjectId(bookingId, 'booking ID');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is either the renter or seller
    const isRenter = booking.renter.user.toString() === req.user._id.toString();
    const isSeller = booking.seller.user.toString() === req.user._id.toString();

    if (!isRenter && !isSeller) {
      throw new ApiError(403, 'You are not authorized to view this booking');
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel a booking
 * @route POST /api/v1/bookings/:bookingId/cancel
 * @access Private (only booking participants)
 */
export const cancelBooking = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;
  const { cancellation_reason } = req.body;

  try {
    // Validate booking ID
    validateObjectId(bookingId, 'booking ID');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is either the renter or seller
    const isRenter = booking.renter.user.toString() === req.user._id.toString();
    const isSeller = booking.seller.user.toString() === req.user._id.toString();

    if (!isRenter && !isSeller) {
      throw new ApiError(403, 'You are not authorized to cancel this booking');
    }

    // Check if booking can be cancelled
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      throw new ApiError(400, 'This booking cannot be cancelled');
    }

    // Start a transaction for multiple DB operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status
      booking.status = 'cancelled';
      booking.cancellation_reason = cancellation_reason;
      booking.cancellation_date = new Date();
      await booking.save({ session });

      // No longer updating vehicle status back to available
      // The vehicle should remain with its current status
      // When checking availability, we should look at the booking dates instead

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Complete a booking
 * @route POST /api/v1/bookings/:bookingId/complete
 * @access Private (only seller)
 */
export const completeBooking = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;
  const { final_odometer_reading, review } = req.body;

  try {
    // Validate booking ID
    validateObjectId(bookingId, 'booking ID');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is the seller
    validateAuthorization(booking, req.user, 'seller.user', 'complete this booking');

    // Check if booking is in progress
    if (booking.status !== 'in_progress') {
      throw new ApiError(400, 'This booking cannot be completed');
    }

    // Validate odometer reading if provided
    if (final_odometer_reading) {
      validatePositiveNumber(final_odometer_reading, 'Odometer reading');
    }

    // Calculate final price based on odometer reading
    const startDate = new Date(booking.booking_start_date);
    const endDate = new Date(booking.booking_end_date);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    let totalPrice = booking.total_price * days;
    let extraCharges = 0;

    if (final_odometer_reading) {
      const kmDriven = final_odometer_reading - booking.initial_odometer_reading;
      const averageKmPerDay = kmDriven / days;

      // Apply extra charges if average daily km exceeds 100
      if (averageKmPerDay > 100) {
        const extraKm = kmDriven - (100 * days);
        extraCharges = extraKm * 10; // Rs 10 per extra km
        totalPrice += extraCharges;
      }
    }

    // Start a transaction for multiple DB operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status and details
      booking.status = 'completed';
      booking.final_odometer_reading = final_odometer_reading;
      booking.extra_charges = extraCharges;
      booking.total_price = totalPrice;
      booking.review = review;
      booking.completion_date = new Date();
      await booking.save({ session });

      // No longer updating vehicle status back to available
      // The vehicle should remain with its current status
      // When checking availability, we should look at the booking dates instead

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }

    res.status(200).json({
      success: true,
      message: 'Booking completed successfully',
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update booking status (start trip or end trip)
 * @route PATCH /api/v1/bookings/:bookingId/status
 * @access Private (only seller)
 */
export const updateBookingStatus = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;
  const { 
    status, 
    initial_odometer, 
    start_time,
    final_odometer, 
    end_time, 
    extra_charges,
    final_price,
    total_km
  } = req.body;

  try {
    // Validate booking ID
    validateObjectId(bookingId, 'booking ID');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is the seller
    validateAuthorization(booking, req.user, 'seller.user', 'update this booking status');

    // Validate status transition
    validateStatusTransition(booking.status, status, 'update');

    console.log('Updating booking status:', {
      bookingId,
      currentStatus: booking.status,
      newStatus: status,
      initial_odometer,
      final_odometer
    });

    // Start a transaction for multiple DB operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking status and additional fields
      booking.status = status;
      
      // For trip start (in_progress)
      if (status === 'in_progress') {
        if (initial_odometer !== undefined) booking.initial_odometer_reading = initial_odometer;
        if (start_time) booking.trip_start_time = start_time || new Date();
      }
      
      // For trip end (completed)
      if (status === 'completed') {
        if (final_odometer !== undefined) booking.final_odometer_reading = final_odometer;
        if (end_time) booking.trip_end_time = end_time || new Date();
        if (extra_charges !== undefined) booking.extra_charges = extra_charges;
        if (final_price !== undefined) booking.final_price = final_price;
        if (total_km !== undefined) booking.total_km = total_km;
        booking.completion_date = new Date();
      }
      
      await booking.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      
      res.status(200).json({
        success: true,
        message: `Booking status updated to ${status} successfully`,
        data: booking
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Update a booking
 * @route PUT /api/v1/bookings/:bookingId
 * @access Private (only seller or renter of the booking)
 */
export const updateBooking = asyncHandler(async (req, res, next) => {
  const { bookingId } = req.params;
  const updateData = req.body;

  try {
    // Validate booking ID
    validateObjectId(bookingId, 'booking ID');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }

    // Check if user is either the renter or seller
    const isRenter = booking.renter.user.toString() === req.user._id.toString();
    const isSeller = booking.seller.user.toString() === req.user._id.toString();

    if (!isRenter && !isSeller) {
      throw new ApiError(403, 'You are not authorized to update this booking');
    }

    // Protected fields that can't be updated directly
    const protectedFields = ['_id', 'vehicle', 'renter', 'seller', 'bid'];
    
    // Remove protected fields from updateData
    protectedFields.forEach(field => {
      delete updateData[field];
    });

    // Update booking with filtered data
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: updatedBooking
    });
  } catch (error) {
    next(error);
  }
}); 