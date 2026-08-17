const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().isString().trim(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const createValidation = [
  body("namaKategori")
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("namaKategori wajib diisi (maksimal 150 karakter)"),
  body("deskripsi").optional({ nullable: true }).isString().withMessage("deskripsi harus berupa teks"),
  body("wajibApproval").optional().isBoolean().withMessage("wajibApproval harus berupa boolean").toBoolean(),
];

const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("namaKategori")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("namaKategori tidak valid (maksimal 150 karakter)"),
  body("deskripsi").optional({ nullable: true }).isString().withMessage("deskripsi harus berupa teks"),
  body("wajibApproval").optional().isBoolean().withMessage("wajibApproval harus berupa boolean").toBoolean(),
];

module.exports = { listValidation, idParamValidation, createValidation, updateValidation };
