import { Vehicle } from '../models/vehicle.model.js';
import { User } from '../models/user.model.js';
import { Category, SuperCategory } from '../models/category.model.js';
import { Address } from '../models/address.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler  from '../utils/asyncHandler.js';

/**
 * Creates a new vehicle listing with uploaded images
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body with vehicle details
 * @param {string} req.body.title - Vehicle title
 * @param {string} req.body.description - Vehicle description
 * @param {number} req.body.basePrice - Base rental price
 * @param {number} [req.body.basePriceOutstation] - Outstation rental price
 * @param {string} req.body.location - General location name
 * @param {Object} req.body.address - Detailed address object
 * @param {string} req.body.category_name - Vehicle category
 * @param {string} [req.body.category_description] - Category description
 * @param {string} req.body.supercategory_name - Vehicle supercategory
 * @param {string} [req.body.supercategory_description] - Supercategory description
 * @param {Array} [req.body.features] - Vehicle features
 * @param {Object} [req.body.specifications] - Vehicle specifications
 * @param {Array} [req.body.availability] - Vehicle availability periods
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Array} req.processedFiles - Processed image files from middleware
 * @param {Object} res - Express response object
 * @returns {Object} API response with created vehicle data
 */
export const addVehicle = asyncHandler(async (req, res) => {
  console.log("Received request body:", req.body);
  const {
    title,
    description,
    basePrice,
    basePriceOutstation,
    location,
    address,
    category_name,
    category_description,
    supercategory_name,
    supercategory_description,
    features,
    specifications,
    availability,
  } = req.body;

  // Validate required fields
  if (!title || !description || !basePrice || !location || !category_name || !supercategory_name) {
    throw new ApiError(400, "Required fields are missing");
  }

  // Get processed vehicle images from the middleware
  const images = req.processedFiles?.map(file => file.url) || [];

  // Get owner information
  const owner = await User.findById(req.user._id);
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  // Check if the supercategory exists, if not create it
  let superCat = await SuperCategory.findOne({ name: supercategory_name });
  if (!superCat) {
    superCat = await SuperCategory.create({
      name: supercategory_name,
      description: supercategory_description || ''
    });
  }

  // Check if the category exists, if not create it
  let categoryDoc = await Category.findOne({ 
    name: category_name,
    supercategory_name: supercategory_name
  });
  
  if (!categoryDoc) {
    categoryDoc = await Category.create({
      name: category_name,
      description: category_description || '',
      supercategory_name: supercategory_name,
      supercategory_description: supercategory_description || ''
    });
  }

  // Create new vehicle with embedded data
  const vehicle = await Vehicle.create({
    owner: owner._id,
    owner_details: {
      name: owner.name,
      email: owner.email,
      phone: owner.phone || ""
    },
    category_name,
    category_description: category_description || '',
    supercategory_name,
    supercategory_description: supercategory_description || '',
    title,
    description,
    pricing: {
      basePrice: Number(basePrice),
      basePriceOutstation: basePriceOutstation ? Number(basePriceOutstation) : Number(basePrice) * 1.2
    },
    location,
    address,
    images,
    features: features ? JSON.parse(features) : [],
    specifications: specifications ? JSON.parse(specifications) : {},
    availability: availability ? JSON.parse(availability) : [],
  });

  return res.status(201).json(
    new ApiResponse(201, vehicle, "Vehicle added successfully")
  );
});

/**
 * Get all vehicles or filter by query parameters
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.category_name] - Filter by category name
 * @param {string} [req.query.supercategory_name] - Filter by supercategory name
 * @param {string} [req.query.location] - Filter by location (partial match)
 * @param {string} [req.query.status] - Filter by vehicle status
 * @param {number} [req.query.minPrice] - Filter by minimum price
 * @param {number} [req.query.maxPrice] - Filter by maximum price
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of results per page
 * @param {boolean} [req.query.includeDeleted=false] - Whether to include deleted vehicles
 * @param {Object} res - Express response object
 * @returns {Object} API response with paginated vehicles and metadata
 */
export const getVehicles = asyncHandler(async (req, res) => {
  const {
    category_name,
    supercategory_name,
    location,
    status,
    minPrice,
    maxPrice,
    page = 1,
    limit = 10,
    includeDeleted = false,
  } = req.query;

  // Build query object
  const query = {};
  
  if (!includeDeleted) {
    query.status = { $ne: 'deleted' };
  }
  
  if (category_name) query.category_name = category_name;
  if (supercategory_name) query.supercategory_name = supercategory_name;
  if (location) query.location = { $regex: location, $options: 'i' }; 
  if (status) query.status = status;
  
  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    query['pricing.basePrice'] = {};
    if (minPrice !== undefined) query['pricing.basePrice'].$gte = Number(minPrice);
    if (maxPrice !== undefined) query['pricing.basePrice'].$lte = Number(maxPrice);
  }

  // Pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  // Execute query with pagination
  const vehicles = await Vehicle.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);

  // Get total count for pagination
  const totalVehicles = await Vehicle.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, {
      vehicles,
      totalVehicles,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalVehicles / limitNumber),
    }, "Vehicles retrieved successfully")
  );
});

/**
 * Get a single vehicle by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.vehicleId - Vehicle ID to retrieve
 * @param {Object} res - Express response object
 * @returns {Object} API response with vehicle data
 */
export const getVehicleById = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  if (!vehicleId) {
    throw new ApiError(400, "Vehicle ID is required");
  }

  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }
  
  // If the vehicle is deleted, include a notice in the response
  let message = "Vehicle retrieved successfully";
  if (vehicle.status === 'deleted') {
    message = "Vehicle retrieved successfully (Note: This vehicle has been deleted)";
  }

  return res.status(200).json(
    new ApiResponse(200, vehicle, message)
  );
});

/**
 * Update a vehicle by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.vehicleId - Vehicle ID to update
 * @param {Object} req.body - Vehicle data to update
 * @param {Object} req.user - Authenticated user from middleware
 * @param {Object} res - Express response object
 * @returns {Object} API response with updated vehicle data
 */
export const updateVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  
  if (!vehicleId) {
    throw new ApiError(400, "Vehicle ID is required");
  }

  // Check if this is a status-only update by checking the URL path
  const isStatusUpdate = req.originalUrl.includes('/status');
  console.log(`Processing vehicle update. Status-only update: ${isStatusUpdate}`);

  // Find the vehicle
  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Check ownership (only owner can update)
  if (vehicle.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to update this vehicle");
  }

  // Update fields from request body
  const updateData = { ...req.body };
  
  // If it's a status-only update, validate the status value
  if (isStatusUpdate) {
    if (!updateData.status) {
      throw new ApiError(400, "Status field is required");
    }
    
    // Validate status value
    const validStatuses = ['available', 'unavailable', 'deleted', 'maintenance'];
    if (!validStatuses.includes(updateData.status)) {
      throw new ApiError(400, `Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    console.log(`Updating vehicle status to: ${updateData.status}`);
    
    // Only update the status field for status-only updates
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      { status: updateData.status },
      { new: true } // Return the updated document
    );

    return res.status(200).json(
      new ApiResponse(200, updatedVehicle, `Vehicle status updated to ${updateData.status}`)
    );
  }
  
  // For full updates, continue with the normal flow
  // Handle special fields that need parsing
  if (updateData.features) updateData.features = JSON.parse(updateData.features);
  if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications);
  if (updateData.availability) updateData.availability = JSON.parse(updateData.availability);
  
  // Handle pricing fields
  if (updateData.basePrice || updateData.basePriceOutstation) {
    updateData.pricing = updateData.pricing || {};
    
    if (updateData.basePrice) {
      updateData.pricing.basePrice = Number(updateData.basePrice);
      delete updateData.basePrice;
    }
    
    if (updateData.basePriceOutstation) {
      updateData.pricing.basePriceOutstation = Number(updateData.basePriceOutstation);
      delete updateData.basePriceOutstation;
    }
  }
  
  // Handle new images if they are uploaded
  if (req.processedFiles && req.processedFiles.length > 0) {
    const newImages = req.processedFiles.map(file => file.url);
    
    // If appendImages flag is true, add to existing images; otherwise replace
    if (req.body.appendImages === 'true') {
      updateData.images = [...vehicle.images, ...newImages];
    } else {
      updateData.images = newImages;
    }
  }

  // Handle category and supercategory updates
  if (updateData.category_name || updateData.supercategory_name) {
    const supercategoryName = updateData.supercategory_name || vehicle.supercategory_name;
    const categoryName = updateData.category_name || vehicle.category_name;
    
    // Check if the supercategory exists, if not create it
    if (updateData.supercategory_name) {
      let superCat = await SuperCategory.findOne({ name: supercategoryName });
      if (!superCat) {
        superCat = await SuperCategory.create({
          name: supercategoryName,
          description: updateData.supercategory_description || ''
        });
      }
    }
    
    // Check if the category exists, if not create it
    if (updateData.category_name || updateData.supercategory_name) {
      let categoryDoc = await Category.findOne({ 
        name: categoryName,
        supercategory_name: supercategoryName
      });
      
      if (!categoryDoc) {
        categoryDoc = await Category.create({
          name: categoryName,
          description: updateData.category_description || vehicle.category_description || '',
          supercategory_name: supercategoryName,
          supercategory_description: updateData.supercategory_description || vehicle.supercategory_description || ''
        });
      }
    }
  }

  // Update address details if address is updated
  if (updateData.address && updateData.address !== vehicle.address?.toString()) {
    const addressDoc = await Address.findById(updateData.address);
    if (addressDoc) {
      updateData.address_details = {
        street: addressDoc.street,
        city: addressDoc.city,
        state: addressDoc.state,
        country: addressDoc.country,
        postal_code: addressDoc.postal_code
      };
    }
  }

  // Update the vehicle
  const updatedVehicle = await Vehicle.findByIdAndUpdate(
    vehicleId,
    updateData,
    { new: true } // Return the updated document
  );

  return res.status(200).json(
    new ApiResponse(200, updatedVehicle, "Vehicle updated successfully")
  );
});

/**
 * Delete a vehicle by ID
 */
export const deleteVehicle = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  if (!vehicleId) {
    throw new ApiError(400, "Vehicle ID is required");
  }

  // Find the vehicle
  const vehicle = await Vehicle.findById(vehicleId);

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Check ownership (only owner can delete)
  if (vehicle.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to delete this vehicle");
  }

  // Soft delete (change status to 'deleted') 
  await Vehicle.findByIdAndUpdate(
    vehicleId,
    { status: 'deleted' }
  );

  return res.status(200).json(
    new ApiResponse(200, {}, "Vehicle deleted successfully")
  );
});

/**
 * Get vehicles owned by the current user
 */
export const getUserVehicles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, includeDeleted = false } = req.query;
  
  // Build query
  const query = { owner: req.user._id };
  
  // By default, exclude vehicles with status 'deleted' unless explicitly requested
  if (!includeDeleted) {
    query.status = { $ne: 'deleted' };
  }
  
  // If status is provided, it will override the default filter
  if (status) query.status = status;
  
  // Pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;
  
  // Execute query
  const vehicles = await Vehicle.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);
    
  // Get total count
  const totalVehicles = await Vehicle.countDocuments(query);
  
  return res.status(200).json(
    new ApiResponse(200, {
      vehicles,
      totalVehicles,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalVehicles / limitNumber),
    }, "User vehicles retrieved successfully")
  );
});

/**
 * Get all categories
 */
export const getCategories = asyncHandler(async (req, res) => {
  const { supercategory_name } = req.query;
  
  const query = {};
  if (supercategory_name) {
    query.supercategory_name = supercategory_name;
  }
  
  const categories = await Category.find(query).sort({ name: 1 });
  
  return res.status(200).json(
    new ApiResponse(200, categories, "Categories retrieved successfully")
  );
});

/**
 * Get all supercategories
 */
export const getSuperCategories = asyncHandler(async (req, res) => {
  const superCategories = await SuperCategory.find().sort({ name: 1 });
  
  return res.status(200).json(
    new ApiResponse(200, superCategories, "Super categories retrieved successfully")
  );
}); 