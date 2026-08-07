const { body } = require("express-validator");

const registerValidation = [
  body("email").isEmail().withMessage("Email tidak valid").normalizeEmail(),
  body("password").isString().isLength({ min: 8 }).withMessage("Password minimal 8 karakter"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Email tidak valid").normalizeEmail(),
  body("password").isString().notEmpty().withMessage("Password wajib diisi"),
];

const refreshValidation = [
  body("refreshToken").isString().notEmpty().withMessage("refreshToken wajib diisi"),
];

module.exports = { registerValidation, loginValidation, refreshValidation };
