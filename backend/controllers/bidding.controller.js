import { Bidding } from "../models/booking.model.js";
import { Vehicle } from "../models/vehicle.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  validateObjectId,
  validateAuthorization,
  validateEnum,
  validateBidData,
} from "../utils/validations.js";
import { SQS } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import {
  sendBidNotificationToSeller,
  sendBidConfirmationToBidder,
} from "../utils/email.util.js";

dotenv.config();

/**
 * Place a bid on a vehicle
 * @route POST /api/v1/bids
 * @access Private
 */
export const placeBid = asyncHandler(async (req, res, next) => {
  const {
    vehicleId,
    bidAmount,
    bookingStartDate,
    bookingEndDate,
    isOutstation = false,
    bidMessage = "",
    govtId = "",
  } = req.body;

  try {
    // Validate bid data using the centralized validation
    validateBidData({ vehicleId, bidAmount, bookingStartDate, bookingEndDate });

    // Validate govt ID
    if (!govtId) {
      throw new ApiError(400, "Government ID is required");
    }

    // Parse dates after validation
    const startDate = new Date(bookingStartDate);
    const endDate = new Date(bookingEndDate);

    // Get vehicle details
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new ApiError(404, "Vehicle not found");
    }

    // Check if the vehicle is available
    if (vehicle.status !== "available") {
      throw new ApiError(400, "Vehicle is not available for bidding");
    }

    // Get seller details
    const owner = await User.findById(vehicle.owner);
    if (!owner) {
      throw new ApiError(404, "Vehicle owner not found");
    }

    // Validate bid amount against vehicle pricing
    const minBidAmount = isOutstation
      ? vehicle.pricing.basePriceOutstation || vehicle.pricing.basePrice
      : vehicle.pricing.basePrice;

    if (bidAmount < minBidAmount) {
      throw new ApiError(400, `Bid amount must be at least ${minBidAmount}`);
    }

    // Create the bid
    const newBid = new Bidding({
      vehicle: vehicleId,
      vehicle_details: {
        title: vehicle.title,
        pricing: {
          basePrice: vehicle.pricing.basePrice,
          basePriceOutstation:
            vehicle.pricing.basePriceOutstation || vehicle.pricing.basePrice,
        },
        images: vehicle.images,
      },
      bidder: {
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        govtId: govtId,
      },
      seller: {
        user: owner._id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone || "",
      },
      bid_amount: bidAmount,
      booking_start_date: startDate,
      booking_end_date: endDate,
      is_outstation: isOutstation,
      bid_message: bidMessage,
      bid_date: new Date(),
      bid_status: "pending",
    });

    // await newBid.save();

    // AWS SDK module for SQS
    // Function to send a message to SQS
    async function awsSendMessage(sqs, params) {
      try {
        // SQS SDK to send a message with the specified parameters
        const data = await sqs.sendMessage(params);
        // Return the response data
        return data;
      } catch (error) {
        // If an error occurs, log the error message
        console.error("Error:", error);
      }
    }


    // An SQS client instance with specified AWS credentials and region
    const sqs = new SQS({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Parameters for the message
    const params = {
      MessageBody: JSON.stringify({ ...newBid }),
      QueueUrl: process.env.biddingQueue_URI,
    };

    // Function to send a message and await the response
    const response = await awsSendMessage(sqs, params);
    // Log the response data
    console.log(response);

    // Send bid notification emails 
    Promise.all([
      sendBidNotificationToSeller(newBid),
      sendBidConfirmationToBidder(newBid),
    ]).catch((err) => {
      console.error("Error sending bid notification emails:", err);
    });

    return res.status(201).json({
      success: true,
      message: "Bid placed successfully",
      data: newBid,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Get all bids made by the authenticated user
 * @route GET /api/bids/user
 * @access Private
 */
export const getUserBids = asyncHandler(async (req, res, next) => {
  const bids = await Bidding.find({ "bidder.user": req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: bids.length,
    data: bids,
  });
});

/**
 * Get all bids for a specific vehicle
 * @route GET /api/bids/vehicle/:vehicleId
 * @access Private (only vehicle owner)
 */
export const getVehicleBids = asyncHandler(async (req, res, next) => {
  const { vehicleId } = req.params;

  try {
    // Validate vehicle ID
    validateObjectId(vehicleId, "vehicle ID");

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new ApiError(404, "Vehicle not found");
    }

    // Check if user is the owner
    validateAuthorization(vehicle, req.user, "owner", "view these bids");

    const bids = await Bidding.find({ vehicle: vehicleId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: bids.length,
      data: bids,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all bids for vehicles owned by the authenticated seller
 * @route GET /api/bids/seller
 * @access Private
 */
export const getSellerBids = asyncHandler(async (req, res, next) => {
  // Get status from query params, default to 'pending'
  const status = req.query.status || "pending";

  // Find all vehicles owned by the user
  const userVehicles = await Vehicle.find({ owner: req.user._id });
  const vehicleIds = userVehicles.map((vehicle) => vehicle._id);

  // Filter bids by status
  const query = {
    vehicle: { $in: vehicleIds },
  };

  // Only add status filter if valid status is provided
  if (
    ["pending", "accepted", "rejected", "expired", "converted"].includes(status)
  ) {
    query.bid_status = status;
  }

  const bids = await Bidding.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: bids.length,
    data: bids,
  });
});

/**
 * Get a specific bid by ID
 * @route GET /api/bids/:bidId
 * @access Private (only bid owner or vehicle owner)
 */
export const getBidById = asyncHandler(async (req, res, next) => {
  const { bidId } = req.params;

  try {
    // Validate bid ID
    validateObjectId(bidId, "bid ID");

    const bid = await Bidding.findById(bidId);
    if (!bid) {
      throw new ApiError(404, "Bid not found");
    }

    // Check if user is either the bidder or the seller
    const isBidder = bid.bidder.user.toString() === req.user._id.toString();
    const isSeller = bid.seller.user.toString() === req.user._id.toString();

    if (!isBidder && !isSeller) {
      throw new ApiError(403, "You are not authorized to view this bid");
    }

    res.status(200).json({
      success: true,
      data: bid,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Respond to a bid (accept/reject)
 * @route POST /api/v1/bids/:bidId/respond
 * @access Private (only vehicle owner)
 */
export const respondToBid = asyncHandler(async (req, res, next) => {
  const { bidId } = req.params;
  const { response, responseMessage } = req.body;

  try {
    // Validate bid ID
    validateObjectId(bidId, "bid ID");

    // Validate response type
    validateEnum(response, ["accepted", "rejected"], "response type");

    const bid = await Bidding.findById(bidId);
    if (!bid) {
      throw new ApiError(404, "Bid not found");
    }

    // Check if user is the seller
    validateAuthorization(bid, req.user, "seller.user", "respond to this bid");

    // Check if bid is already responded to
    if (bid.bid_status !== "pending") {
      throw new ApiError(400, `Bid is already ${bid.bid_status}`);
    }

    // Update the bid
    bid.bid_status = response;
    bid.response_message = responseMessage || "";
    bid.response_date = new Date();

    await bid.save();

    res.status(200).json({
      success: true,
      message: `Bid ${response} successfully`,
      data: bid,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel a bid
 * @route POST /api/v1/bids/:bidId/cancel
 * @access Private (only bidder)
 */
export const cancelBid = asyncHandler(async (req, res, next) => {
  const { bidId } = req.params;

  try {
    // Validate bid ID
    validateObjectId(bidId, "bid ID");

    const bid = await Bidding.findById(bidId);
    if (!bid) {
      throw new ApiError(404, "Bid not found");
    }

    // Check if user is the bidder
    validateAuthorization(bid, req.user, "bidder.user", "cancel this bid");

    // Check if bid is still pending
    if (bid.bid_status !== "pending") {
      throw new ApiError(
        400,
        `Cannot cancel bid that is already ${bid.bid_status}`
      );
    }

    // Check if booking start date is within 24 hours
    const now = new Date();
    const startDate = new Date(bid.booking_start_date);
    const hoursUntilStart = (startDate - now) / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
      throw new ApiError(
        400,
        "Cannot cancel bid within 24 hours of booking start time"
      );
    }

    // Update the bid
    bid.bid_status = "expired";
    bid.response_message = "Cancelled by bidder";
    bid.response_date = new Date();

    await bid.save();

    res.status(200).json({
      success: true,
      message: "Bid cancelled successfully",
      data: bid,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get the highest bid amount for a specific vehicle
 * @route GET /api/v1/bidding/highest/:vehicleId
 * @access Public
 */
export const getHighestBid = asyncHandler(async (req, res, next) => {
  const { vehicleId } = req.params;

  try {
    // Validate vehicle ID
    validateObjectId(vehicleId, "vehicle ID");

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new ApiError(404, "Vehicle not found");
    }

    // Get all bids for this vehicle
    const bids = await Bidding.find({
      vehicle: vehicleId,
      bid_status: { $in: ["pending", "accepted"] },
    });

    if (!bids || bids.length === 0) {
      return res.status(200).json({
        success: true,
        data: { highestBid: null },
      });
    }

    // Find the highest bid amount
    const highestBid = Math.max(...bids.map((bid) => Number(bid.bid_amount)));

    res.status(200).json({
      success: true,
      data: { highestBid },
    });
  } catch (error) {
    next(error);
  }
});

// Export other necessary functions if needed
