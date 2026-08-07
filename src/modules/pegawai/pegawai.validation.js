const { param, body, query } = require("express-validator");

const ALLOWED_JENIS_KELAMIN = ["Laki-laki", "Perempuan"];
const ALLOWED_STATUS = ["aktif", "nonaktif", "pensiun"];

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().isString().trim(),
  query("divisiId").optional().isUUID().withMessage("divisiId tidak valid"),
  query("jabatanId").optional().isUUID().withMessage("jabatanId tidak valid"),
  query("status").optional().isIn(ALLOWED_STATUS).withMessage("status tidak valid"),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const createValidation = [
  body("userId").isUUID().withMessage("userId wajib diisi dan berupa UUID"),
  body("nip")
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage("nip wajib diisi (maksimal 30 karakter)"),
  body("namaLengkap")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("namaLengkap wajib diisi (maksimal 200 karakter)"),
  body("divisiId").optional({ nullable: true }).isUUID().withMessage("divisiId tidak valid"),
  body("jabatanId").optional({ nullable: true }).isUUID().withMessage("jabatanId tidak valid"),
  body("jenisKelamin")
    .optional({ nullable: true })
    .isIn(ALLOWED_JENIS_KELAMIN)
    .withMessage("jenisKelamin tidak valid"),
  body("tempatLahir").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("tanggalLahir")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("tanggalLahir harus format tanggal valid (YYYY-MM-DD)"),
  body("alamat").optional({ nullable: true }).isString(),
  body("noTelepon").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body("tanggalMasuk")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("tanggalMasuk harus format tanggal valid (YYYY-MM-DD)"),
  body("statusKepegawaian").optional().isIn(ALLOWED_STATUS).withMessage("statusKepegawaian tidak valid"),
];

const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("userId").not().exists().withMessage("userId tidak boleh diubah"),
  body("nip")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage("nip tidak valid (maksimal 30 karakter)"),
  body("namaLengkap")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("namaLengkap tidak valid"),
  body("divisiId").optional({ nullable: true }).isUUID().withMessage("divisiId tidak valid"),
  body("jabatanId").optional({ nullable: true }).isUUID().withMessage("jabatanId tidak valid"),
  body("jenisKelamin")
    .optional({ nullable: true })
    .isIn(ALLOWED_JENIS_KELAMIN)
    .withMessage("jenisKelamin tidak valid"),
  body("tempatLahir").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("tanggalLahir")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("tanggalLahir harus format tanggal valid (YYYY-MM-DD)"),
  body("alamat").optional({ nullable: true }).isString(),
  body("noTelepon").optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body("tanggalMasuk")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("tanggalMasuk harus format tanggal valid (YYYY-MM-DD)"),
  body("statusKepegawaian").optional().isIn(ALLOWED_STATUS).withMessage("statusKepegawaian tidak valid"),
];

module.exports = { listValidation, idParamValidation, createValidation, updateValidation };
