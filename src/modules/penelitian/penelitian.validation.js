const { param, body, query } = require("express-validator");

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("tahun").optional().isInt({ min: YEAR_MIN, max: YEAR_MAX }).withMessage("tahun tidak valid").toInt(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const anggotaIdParamValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("anggotaId").isUUID().withMessage("anggotaId tidak valid"),
];

const publikasiIdParamValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("publikasiId").isUUID().withMessage("publikasiId tidak valid"),
];

// pegawaiId hanya boleh dikirim oleh admin/hrd (menunjuk pegawai lain);
// pegawai selalu membuat penelitian miliknya sendiri (ditegakkan di Service) —
// mengikuti pola dokumen.validation.js#createValidation persis.
const createValidation = [
  body("pegawaiId")
    .if((value, { req }) => ["admin", "hrd"].includes(req.user?.role))
    .exists()
    .withMessage("pegawaiId wajib diisi")
    .bail()
    .isUUID()
    .withMessage("pegawaiId harus UUID valid"),
  body("pegawaiId")
    .if((value, { req }) => req.user?.role === "pegawai")
    .custom((value) => {
      if (value !== undefined) {
        throw new Error("pegawaiId tidak boleh dikirim untuk role pegawai");
      }
      return true;
    }),
  body("judul").isString().trim().isLength({ min: 1, max: 300 }).withMessage("judul wajib diisi"),
  body("skema").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body("dana")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("dana harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("tahun").isInt({ min: YEAR_MIN, max: YEAR_MAX }).withMessage("tahun wajib diisi dan valid").toInt(),
];

// pegawaiId tidak boleh diubah setelah dibuat — sama seperti kpi/roadmap_karier.
const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("judul").optional().isString().trim().isLength({ min: 1, max: 300 }),
  body("skema").optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body("dana")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("dana harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("tahun").optional().isInt({ min: YEAR_MIN, max: YEAR_MAX }).withMessage("tahun tidak valid").toInt(),
];

const createAnggotaValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").isUUID().withMessage("pegawaiId wajib diisi dan berupa UUID"),
];

const createPublikasiValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("judul").isString().trim().isLength({ min: 1, max: 300 }).withMessage("judul wajib diisi"),
  body("jurnal").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body("terindeks").optional().isBoolean().withMessage("terindeks harus boolean").toBoolean(),
  body("tahun").isInt({ min: YEAR_MIN, max: YEAR_MAX }).withMessage("tahun wajib diisi dan valid").toInt(),
];

const updatePublikasiValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("publikasiId").isUUID().withMessage("publikasiId tidak valid"),
  body("judul").optional().isString().trim().isLength({ min: 1, max: 300 }),
  body("jurnal").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body("terindeks").optional().isBoolean().withMessage("terindeks harus boolean").toBoolean(),
  body("tahun").optional().isInt({ min: YEAR_MIN, max: YEAR_MAX }).withMessage("tahun tidak valid").toInt(),
];

module.exports = {
  listValidation,
  idParamValidation,
  anggotaIdParamValidation,
  publikasiIdParamValidation,
  createValidation,
  updateValidation,
  createAnggotaValidation,
  createPublikasiValidation,
  updatePublikasiValidation,
};
