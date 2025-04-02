import express from 'express';
import { 
  getAllUsers, 
  getAdminStats, 
  updateUserRole, 
  deleteUser,
  toggleUserLock
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/role.middleware.js';

const router = express.Router();

// Apply both middleware to all admin routes
// First authenticate the user, then check if they're an admin
router.use(authenticate, isAdmin);

/**
 * @route     GET /api/v1/admin/users
 * @desc      Get all users for admin dashboard with pagination and search
 * @access    Private/Admin
 * @query     page - Current page (default: 1)
 * @query     limit - Results per page (default: 10)
 * @query     search - Search term for name or email
 * @returns   {success: Boolean, message: String, data: {users: Array, pagination: Object}}
 */
router.get('/users', getAllUsers);

/**
 * @route     GET /api/v1/admin/stats
 * @desc      Get admin dashboard statistics
 * @access    Private/Admin
 * @params    None
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.get('/stats', getAdminStats);

/**
 * @route     PATCH /api/v1/admin/users/:userId/role
 * @desc      Update user role
 * @access    Private/Admin
 * @params    userId
 * @body      {role: String}
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.patch('/users/:userId/role', updateUserRole);

/**
 * @route     DELETE /api/v1/admin/users/:userId
 * @desc      Delete a user
 * @access    Private/Admin
 * @params    userId
 * @returns   {success: Boolean, message: String}
 */
router.delete('/users/:userId', deleteUser);

/**
 * @route     PATCH /api/v1/admin/users/:userId/toggle-lock
 * @desc      Toggle user locked status
 * @access    Private/Admin
 * @params    userId
 * @returns   {success: Boolean, message: String, data: {user: Object}}
 */
router.patch('/users/:userId/toggle-lock', toggleUserLock);

export default router; 