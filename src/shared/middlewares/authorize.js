const AppError = require("../exceptions/appError");

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Anda tidak memiliki akses untuk resource ini", 403));
    }
    next();
  };
};

module.exports = authorize;
