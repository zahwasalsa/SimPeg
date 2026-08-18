const { param, body, query } = require("express-validator");

const STATUS_VALUES = ["in_progress", "eligible", "promoted"];

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

// Admin/HRD only (route-level authorize). `progress` dibatasi 0-100 —
// merepresentasikan persentase pemenuhan persyaratan promosi (FR-CAREER-004),
// beda dari kpi.achievement yang boleh melebihi target. `status` dibatasi ke
// 3 nilai enum blueprint tanpa aturan urutan transisi (blueprint tidak
// menetapkannya, jadi tidak ditegakkan di sini).
const createValidation = [
  body("pegawaiId").isUUID().withMessage("pegawaiId wajib diisi dan berupa UUID"),
  body("jabatanSaatIniId").optional({ nullable: true }).isUUID().withMessage("jabatanSaatIniId tidak valid"),
  body("jabatanTargetId").optional({ nullable: true }).isUUID().withMessage("jabatanTargetId tidak valid"),
  body("persyaratan").optional().isString().trim().isLength({ max: 2000 }),
  body("progress")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("progress harus berupa angka antara 0 dan 100")
    .toFloat(),
  body("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
];

// pegawaiId tidak boleh diubah setelah dibuat — sama seperti kpi.
const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("jabatanSaatIniId").optional({ nullable: true }).isUUID().withMessage("jabatanSaatIniId tidak valid"),
  body("jabatanTargetId").optional({ nullable: true }).isUUID().withMessage("jabatanTargetId tidak valid"),
  body("persyaratan").optional().isString().trim().isLength({ max: 2000 }),
  body("progress")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("progress harus berupa angka antara 0 dan 100")
    .toFloat(),
  body("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
];

module.exports = {
  listValidation,
  idParamValidation,
  createValidation,
  updateValidation,
};
