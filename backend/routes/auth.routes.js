import express from 'express';
import { register, login, becomeSeller, logout, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// ========= Authentication Routes =========

/**
 * @route     POST /api/v1/auth/register
 * @desc      Register a new user
 * @access    Public
 * @params    None
 * @body      {
 *              name: String,
 *              email: String,
 *              password: String,
 *              phone: String
 *            }
 * @returns   {success: Boolean, message: String, data: Object, token: String}
 */
router.post('/register', register);

/**
 * @route     POST /api/v1/auth/login
 * @desc      Authenticate user & get token
 * @access    Public
 * @params    None
 * @body      {email: String, password: String}
 * @returns   {success: Boolean, message: String, data: Object, token: String}
 */
router.post('/login', login);

/**
 * @route     GET /api/v1/auth/me
 * @desc      Get current user's profile information 
 * @access    Private
 * @params    None
 * @body      None
 * @returns   {success: Boolean, message: String, data: {user: Object}}
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @route     PATCH /api/v1/auth/become-seller
 * @desc      Convert regular user to seller
 * @access    Private
 * @params    None
 * @body      {address: Object} - Complete address details
 * @returns   {success: Boolean, message: String, data: Object}
 */
router.patch('/become-seller', authenticate, becomeSeller);

/**
 * @route     POST /api/v1/auth/logout
 * @desc      Logout user by clearing the auth cookie
 * @access    Public
 * @params    None
 * @body      None
 * @returns   {success: Boolean, message: String}
 */
router.post('/logout', logout);

export default router; 