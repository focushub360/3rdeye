/**
 * Middleware to restrict access to inspector role only
 */
export const inspectorOnly = (req, res, next) => {
  if (req.user && ['inspector', 'user', 'subadmin', 'admin', 'superadmin'].includes(req.user.role)) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied. Valid staff role required.'
  });
};
