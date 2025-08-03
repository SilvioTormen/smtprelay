/**
 * Role-Based Access Control Middleware
 */

// Permission checks for different roles
const rolePermissions = {
  admin: ['read', 'write', 'delete', 'configure', 'manage_users'],
  operator: ['read', 'write'],
  viewer: ['read']
};

// Check if user has required permission
const hasPermission = (userRole, requiredPermission) => {
  const permissions = rolePermissions[userRole] || [];
  return permissions.includes(requiredPermission);
};

// Middleware to require specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      // Log security event
      console.log(`SECURITY: Unauthorized access attempt - User: ${req.user.username}, Role: ${req.user.role}, Required: ${permission}`);
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: permission,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Middleware to require write access
const requireWrite = requirePermission('write');

// Middleware to require configure access
const requireConfigure = requirePermission('configure');

// Middleware to require delete access
const requireDelete = requirePermission('delete');

// Check if operation is read-only
const isReadOnly = (method) => {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
};

// Generic role-based access control
const enforceRBAC = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  // Admins can do everything
  if (req.user.role === 'admin') {
    return next();
  }

  // Check based on HTTP method
  if (isReadOnly(req.method)) {
    // Everyone can read
    return next();
  }

  // For write operations
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (hasPermission(req.user.role, 'write')) {
      return next();
    }
  }

  // For delete operations
  if (req.method === 'DELETE') {
    if (hasPermission(req.user.role, 'delete')) {
      return next();
    }
  }

  // Log unauthorized attempt
  console.log(`SECURITY: Unauthorized ${req.method} attempt - User: ${req.user.username}, Role: ${req.user.role}, Path: ${req.path}`);
  
  return res.status(403).json({
    error: 'Insufficient permissions for this operation',
    code: 'FORBIDDEN',
    method: req.method,
    userRole: req.user.role
  });
};

module.exports = {
  rolePermissions,
  hasPermission,
  requirePermission,
  requireWrite,
  requireConfigure,
  requireDelete,
  enforceRBAC,
  isReadOnly
};