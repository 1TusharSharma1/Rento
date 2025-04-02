import { Router } from 'express';
import { 
  addVehicle, 
  getVehicles, 
  getVehicleById, 
  updateVehicle, 
  deleteVehicle, 
  getUserVehicles,
  getCategories,
  getSuperCategories
} from '../controllers/vehicle.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { uploadVehicleImages, handleUploadErrors } from '../middleware/upload.middleware.js';

const router = Router();

/**
 * Vehicle and Category Routes
 * Base path: /api/v1/vehicles
 */

/**
 * Get all vehicle categories
 * 
 * @route GET /api/v1/vehicles/categories
 * @access Public - No authentication required
 * @queryParam {string} [supercategory_name] - Filter categories by supercategory
 * @returns {Object} List of vehicle categories
 */
router.route('/categories').get(getCategories);

/**
 * Get all vehicle supercategories
 * 
 * @route GET /api/v1/vehicles/supercategories
 * @access Public - No authentication required
 * @returns {Object} List of vehicle supercategories
 */
router.route('/supercategories').get(getSuperCategories);

/**
 * Get all vehicles with optional filtering
 * 
 * @route GET /api/v1/vehicles
 * @access Public - No authentication required
 * @queryParam {string} [category_name] - Filter by category name
 * @queryParam {string} [supercategory_name] - Filter by supercategory name
 * @queryParam {string} [location] - Filter by location (partial match)
 * @queryParam {string} [status] - Filter by vehicle status
 * @queryParam {number} [minPrice] - Filter by minimum price
 * @queryParam {number} [maxPrice] - Filter by maximum price
 * @queryParam {number} [page=1] - Page number for pagination
 * @queryParam {number} [limit=10] - Results per page
 * @queryParam {boolean} [includeDeleted=false] - Include deleted vehicles
 * @returns {Object} Paginated list of vehicles matching criteria
 */
router.route('/').get(getVehicles);

/**
 * Add a new vehicle listing
 * 
 * @route POST /api/v1/vehicles
 * @access Private - Requires authentication
 * @requestBody {string} title - Vehicle title
 * @requestBody {string} description - Vehicle description
 * @requestBody {number} basePrice - Base rental price
 * @requestBody {number} [basePriceOutstation] - Outstation rental price
 * @requestBody {string} location - General location name
 * @requestBody {Object} address - Detailed address object
 * @requestBody {string} category_name - Vehicle category
 * @requestBody {string} supercategory_name - Vehicle supercategory
 * @requestBody {string} [category_description] - Category description
 * @requestBody {string} [supercategory_description] - Supercategory description
 * @requestBody {Array<File>} vehicleImages - Vehicle images (max 5)
 * @returns {Object} Created vehicle data
 */
router.route('/').post(authenticate, uploadVehicleImages, handleUploadErrors, addVehicle);

/**
 * Get vehicles owned by the current user
 * 
 * @route GET /api/v1/vehicles/user
 * @access Private - Requires authentication
 * @queryParam {number} [page=1] - Page number for pagination
 * @queryParam {number} [limit=10] - Results per page
 * @queryParam {string} [status] - Filter by vehicle status
 * @queryParam {boolean} [includeDeleted=false] - Include deleted vehicles
 * @returns {Object} Paginated list of user's vehicles
 */
router.route('/user').get(authenticate, getUserVehicles);

/**
 * Get a specific vehicle by ID
 * 
 * @route GET /api/v1/vehicles/:vehicleId
 * @access Public - No authentication required
 * @urlParam {string} vehicleId - MongoDB ID of the vehicle
 * @returns {Object} Vehicle data
 */
router.route('/:vehicleId').get(getVehicleById);

/**
 * Update only a vehicle's status
 * 
 * @route PUT /api/v1/vehicles/:vehicleId/status
 * @access Private - Requires authentication (owner only)
 * @urlParam {string} vehicleId - MongoDB ID of the vehicle
 * @requestBody {string} status - New status ('available', 'unavailable', 'maintenance', 'deleted')
 * @returns {Object} Updated vehicle data
 */
router.route('/:vehicleId/status').put(authenticate, updateVehicle);

/**
 * Update a vehicle listing
 * 
 * @route PUT /api/v1/vehicles/:vehicleId
 * @access Private - Requires authentication (owner only)
 * @urlParam {string} vehicleId - MongoDB ID of the vehicle
 * @requestBody {string} [title] - Vehicle title
 * @requestBody {string} [description] - Vehicle description
 * @requestBody {number} [basePrice] - Base rental price
 * @requestBody {number} [basePriceOutstation] - Outstation rental price
 * @requestBody {string} [location] - General location name
 * @requestBody {Object} [address] - Detailed address object
 * @requestBody {Array<File>} [vehicleImages] - Vehicle images (max 5)
 * @requestBody {boolean} [appendImages=false] - Whether to append or replace images
 * @returns {Object} Updated vehicle data
 */
router.route('/:vehicleId').put(authenticate, uploadVehicleImages, handleUploadErrors, updateVehicle);

/**
 * Delete a vehicle (soft delete)
 * 
 * @route DELETE /api/v1/vehicles/:vehicleId
 * @access Private - Requires authentication (owner only)
 * @urlParam {string} vehicleId - MongoDB ID of the vehicle
 * @returns {Object} Success confirmation message
 */
router.route('/:vehicleId').delete(authenticate, deleteVehicle);

export default router; 