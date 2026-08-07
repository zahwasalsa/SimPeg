const { validationResult } = require("express-validator");
const AppError = require("../exceptions/appError");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError("Validasi gagal", 422, errors.array()));
  }
  next();
};

module.exports = validate;
