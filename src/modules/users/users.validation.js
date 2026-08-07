const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const roleValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("role").isIn(["admin", "hrd", "pegawai", "pimpinan"]).withMessage("Role tidak valid"),
];

const statusValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("isActive").isBoolean().withMessage("isActive harus boolean").toBoolean(),
];

module.exports = { listValidation, idParamValidation, roleValidation, statusValidation };
