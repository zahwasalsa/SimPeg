const AppError = require("../exceptions/appError");

// Allows access if the caller has one of `roles`, OR the resource id in
// req.params[paramKey] refers to the caller's own user id.
const authorizeSelfOrRoles = (paramKey, ...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    const isPrivilegedRole = roles.includes(req.user.role);
    const isOwnResource = req.params[paramKey] === req.user.id;

    if (!isPrivilegedRole && !isOwnResource) {
      return next(new AppError("Anda tidak memiliki akses untuk resource ini", 403));
    }

    next();
  };
};

module.exports = authorizeSelfOrRoles;
