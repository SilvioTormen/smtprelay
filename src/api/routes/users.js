const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const {
  authenticate,
  hashPassword,
  generateTokens,
  validatePasswordStrength,
  sanitizeInput
} = require('../middleware/auth');

const router = express.Router();

// In-memory user store (should be replaced with database in production)
// This will be shared with auth.js
const getUsers = () => {
  const authRoutes = require('./auth');
  return authRoutes.users;
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admin privileges required.',
      code: 'FORBIDDEN'
    });
  }
  next();
};

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = getUsers();
    const userList = Array.from(users.values()).map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt || new Date().toISOString(),
      lastLogin: user.lastLogin || null,
      failedAttempts: user.failedAttempts || 0,
      lockedUntil: user.lockedUntil || null,
      isLocked: user.lockedUntil ? user.lockedUntil > Date.now() : false
    }));

    res.json({
      success: true,
      users: userList,
      total: userList.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      code: 'FETCH_ERROR'
    });
  }
});

// Get single user (admin only)
router.get('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = getUsers();
    const user = Array.from(users.values()).find(u => u.id === req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || null,
        failedAttempts: user.failedAttempts || 0,
        isLocked: user.lockedUntil ? user.lockedUntil > Date.now() : false
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      code: 'FETCH_ERROR'
    });
  }
});

// Create new user (admin only)
router.post('/', 
  authenticate,
  requireAdmin,
  [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_-]+$/).escape(),
    body('password').isLength({ min: 8, max: 100 }),
    body('role').isIn(['admin', 'operator', 'viewer']),
    body('permissions').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { username, password, role, permissions } = req.body;
      const users = getUsers();

      // Check if username already exists
      if (users.has(username)) {
        return res.status(409).json({
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Password does not meet requirements',
          code: 'WEAK_PASSWORD',
          requirements: passwordValidation.errors
        });
      }

      // Create new user
      const newUser = {
        id: crypto.randomUUID(),
        username: sanitizeInput(username),
        password: await hashPassword(password),
        role,
        permissions: permissions || getDefaultPermissions(role),
        twoFactorSecret: null,
        twoFactorEnabled: false,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
        createdBy: req.user.userId,
        lastLogin: null
      };

      users.set(username, newUser);

      // Log user creation
      console.log(`User created: ${username} by ${req.user.username}`);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
          permissions: newUser.permissions
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        error: 'Failed to create user',
        code: 'CREATE_ERROR'
      });
    }
  }
);

// Update user (admin only)
router.put('/:userId',
  authenticate,
  requireAdmin,
  [
    body('role').optional().isIn(['admin', 'operator', 'viewer']),
    body('permissions').optional().isArray(),
    body('resetPassword').optional().isBoolean(),
    body('newPassword').optional().isLength({ min: 8, max: 100 }),
    body('unlockAccount').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const users = getUsers();
      const user = Array.from(users.values()).find(u => u.id === req.params.userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Prevent admin from modifying their own role
      if (user.id === req.user.userId && req.body.role) {
        return res.status(400).json({
          error: 'Cannot modify your own role',
          code: 'SELF_ROLE_CHANGE'
        });
      }

      // Update role
      if (req.body.role) {
        user.role = req.body.role;
        user.permissions = req.body.permissions || getDefaultPermissions(req.body.role);
      }

      // Reset password if requested
      if (req.body.resetPassword && req.body.newPassword) {
        const passwordValidation = validatePasswordStrength(req.body.newPassword);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            error: 'Password does not meet requirements',
            code: 'WEAK_PASSWORD',
            requirements: passwordValidation.errors
          });
        }
        user.password = await hashPassword(req.body.newPassword);
        user.passwordResetRequired = true;
      }

      // Unlock account if requested
      if (req.body.unlockAccount) {
        user.failedAttempts = 0;
        user.lockedUntil = null;
      }

      // Update modification metadata
      user.lastModified = new Date().toISOString();
      user.modifiedBy = req.user.userId;

      console.log(`User updated: ${user.username} by ${req.user.username}`);

      res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          isLocked: user.lockedUntil ? user.lockedUntil > Date.now() : false
        }
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        error: 'Failed to update user',
        code: 'UPDATE_ERROR'
      });
    }
  }
);

// Delete user (admin only)
router.delete('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = getUsers();
    const user = Array.from(users.values()).find(u => u.id === req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.userId) {
      return res.status(400).json({
        error: 'Cannot delete your own account',
        code: 'SELF_DELETE'
      });
    }

    // Prevent deleting the last admin
    const adminCount = Array.from(users.values()).filter(u => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({
        error: 'Cannot delete the last admin account',
        code: 'LAST_ADMIN'
      });
    }

    // Delete user
    users.delete(user.username);

    console.log(`User deleted: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      code: 'DELETE_ERROR'
    });
  }
});

// Reset user's 2FA (admin only)
router.post('/:userId/reset-2fa', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = getUsers();
    const user = Array.from(users.values()).find(u => u.id === req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;

    console.log(`2FA reset for user: ${user.username} by ${req.user.username}`);

    res.json({
      success: true,
      message: '2FA reset successfully'
    });
  } catch (error) {
    console.error('Error resetting 2FA:', error);
    res.status(500).json({
      error: 'Failed to reset 2FA',
      code: 'RESET_2FA_ERROR'
    });
  }
});

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
  const permissions = {
    admin: ['read', 'write', 'delete', 'configure', 'manage_users'],
    operator: ['read', 'write'],
    viewer: ['read']
  };
  return permissions[role] || ['read'];
}

// Export users for auth.js to use
router.users = getUsers();

module.exports = router;