const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().isString().trim(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const createValidation = [
  body("namaJabatan")
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("namaJabatan wajib diisi (maksimal 150 karakter)"),
  body("deskripsi").optional({ nullable: true }).isString().withMessage("deskripsi harus berupa teks"),
];

const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("namaJabatan")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("namaJabatan tidak valid (maksimal 150 karakter)"),
  body("deskripsi").optional({ nullable: true }).isString().withMessage("deskripsi harus berupa teks"),
];

module.exports = { listValidation, idParamValidation, createValidation, updateValidation };
