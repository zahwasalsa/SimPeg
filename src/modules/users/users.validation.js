const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

// Kebijakan password sama seperti auth.validation.js#registerValidation.
const createValidation = [
  body("email").isEmail().withMessage("Email tidak valid").normalizeEmail(),
  body("password").isString().isLength({ min: 8 }).withMessage("Password minimal 8 karakter"),
  body("role").isIn(["admin", "hrd", "pegawai", "pimpinan"]).withMessage("Role tidak valid"),
];

const emailValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("email").isEmail().withMessage("Email tidak valid").normalizeEmail(),
];

// Kebijakan sama seperti auth.validation.js#registerValidation — minimal 8
// karakter, tidak ada aturan kompleksitas tambahan (Supabase Auth tidak
// mensyaratkan lebih dari itu di proyek ini).
const passwordValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("password").isString().isLength({ min: 8 }).withMessage("Password minimal 8 karakter"),
];

const roleValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("role").isIn(["admin", "hrd", "pegawai", "pimpinan"]).withMessage("Role tidak valid"),
];

const statusValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("isActive").isBoolean().withMessage("isActive harus boolean").toBoolean(),
];

module.exports = {
  listValidation,
  idParamValidation,
  createValidation,
  emailValidation,
  passwordValidation,
  roleValidation,
  statusValidation,
};
