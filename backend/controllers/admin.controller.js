import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all users for admin dashboard with pagination and search
 * @route GET /api/v1/admin/users
 * @access Private/Admin
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const currentAdminId = req.user._id;
  
  // Create search query if provided, excluding the current admin
  const searchQuery = {
    _id: { $ne: currentAdminId } // Exclude current admin
  };
  
  // Add search criteria if search term provided
  if (search) {
    searchQuery.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }
  
  const [totalUsers, users] = await Promise.all([
    // Count total documents for pagination (excluding current admin)
    User.countDocuments(searchQuery),
    
    // Get paginated results
    User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()
  ]);
    
  return res.status(200).json(
    new ApiResponse(200, {
      users,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalUsers / limit)
      }
    }, 'Users retrieved successfully')
  );
});

/**
 * Get admin dashboard statistics
 * @route GET /api/v1/admin/stats
 * @access Private/Admin
 */
export const getAdminStats = asyncHandler(async (req, res) => {
  // Get total users count
  const totalUsers = await User.countDocuments();
  
  // Get users by role
  const sellers = await User.countDocuments({ role: 'seller' });
  const buyers = await User.countDocuments({ role: 'user' });
  const admins = await User.countDocuments({ role: 'admin' });
  
  // Get recent users - last 7 days
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  
  const newUsers = await User.countDocuments({
    createdAt: { $gte: lastWeekDate }
  });
  
  return res.status(200).json(
    new ApiResponse(200, {
      totalUsers,
      roleCounts: {
        sellers,
        buyers,
        admins
      },
      newUsers
    }, 'Admin stats retrieved successfully')
  );
});

/**
 * Update user role
 * @route PATCH /api/v1/admin/users/:userId/role
 * @access Private/Admin
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  
  if (!role || !['user', 'seller', 'admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role specified');
  }
  
  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  return res.status(200).json(
    new ApiResponse(200, user, 'User role updated successfully')
  );
});

/**
 * Delete user
 * @route DELETE /api/v1/admin/users/:userId
 * @access Private/Admin
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const user = await User.findByIdAndDelete(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  return res.status(200).json(
    new ApiResponse(200, {}, 'User deleted successfully')
  );
});

/**
 * Toggle user locked status
 * @route PATCH /api/v1/admin/users/:userId/toggle-lock
 * @access Private/Admin
 */
export const toggleUserLock = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Toggle the locked status
  user.isLocked = !user.isLocked;
  await user.save();
  
  return res.status(200).json(
    new ApiResponse(200, {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isLocked: user.isLocked
      }
    }, `User ${user.isLocked ? 'locked' : 'unlocked'} successfully`)
  );
}); 