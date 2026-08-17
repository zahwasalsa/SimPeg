const { param, body, query } = require("express-validator");

const STATUS_VALUES = ["not_started", "on_track", "at_risk", "achieved"];

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("period").optional().isString().trim(),
  query("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
];

const summaryValidation = [
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("period").optional().isString().trim(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const detailIdParamValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("detailId").isUUID().withMessage("detailId tidak valid"),
];

// HRD/Admin only (route-level authorize) — pegawaiId/period/target wajib,
// achievement/percentage/status tidak boleh dikirim (selalu 0/server-computed
// saat KPI baru dibuat). `details` opsional — array indikator awal, masing-
// masing membuat satu baris kpi_detail sekaligus dengan KPI-nya; kalau
// dikirim, wajib berisi minimal satu entri (array kosong ditolak — kalau
// tidak ada indikator, cukup jangan sertakan field `details` sama sekali).
const createValidation = [
  body("pegawaiId").isUUID().withMessage("pegawaiId wajib diisi dan berupa UUID"),
  body("period").isString().trim().isLength({ min: 1, max: 20 }).withMessage("period wajib diisi"),
  body("target")
    .isFloat({ min: 0 })
    .withMessage("target wajib diisi, berupa angka, dan tidak boleh negatif")
    .toFloat(),
  body("achievement").not().exists().withMessage("achievement tidak boleh dikirim saat membuat KPI"),
  body("details")
    .optional()
    .isArray({ min: 1 })
    .withMessage("details harus berupa array dan minimal berisi satu indikator jika dikirim"),
  body("details.*.indicator")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("details[].indicator wajib diisi"),
  body("details.*.target")
    .isFloat({ min: 0 })
    .withMessage("details[].target wajib diisi, berupa angka, dan tidak boleh negatif")
    .toFloat(),
  body("details.*.weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("details[].weight harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("details.*.realization")
    .not()
    .exists()
    .withMessage("details[].realization tidak boleh dikirim saat membuat indikator"),
];

// Pegawai hanya boleh mengirim achievement dan/atau details[].realization
// (ditegakkan di Service); admin/hrd boleh juga mengirim period/target dan
// details[].indicator/target/weight. pegawaiId tidak boleh diubah. Setiap
// entri details[] wajib punya `id` (kpi_detail.id yang sudah ada) — details[]
// di endpoint ini hanya mengubah indikator yang sudah ada, bukan membuat baru
// (menambah indikator baru tetap lewat POST /kpi/:id/detail).
const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("period").optional().isString().trim().isLength({ min: 1, max: 20 }),
  body("target")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("target harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("achievement")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("achievement harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("details")
    .optional()
    .isArray({ min: 1 })
    .withMessage("details harus berupa array dan minimal berisi satu entri jika dikirim"),
  body("details.*.id").isUUID().withMessage("details[].id wajib diisi dan berupa UUID"),
  body("details.*.indicator").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("details.*.target")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("details[].target harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("details.*.weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("details[].weight harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("details.*.realization")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("details[].realization harus berupa angka dan tidak boleh negatif")
    .toFloat(),
];

// HRD/Admin only (route-level authorize) — mendefinisikan indikator baru.
const createDetailValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("indicator").isString().trim().isLength({ min: 1, max: 200 }).withMessage("indicator wajib diisi"),
  body("target")
    .isFloat({ min: 0 })
    .withMessage("target wajib diisi, berupa angka, dan tidak boleh negatif")
    .toFloat(),
  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("weight harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("realization").not().exists().withMessage("realization tidak boleh dikirim saat membuat indikator"),
];

// Pegawai hanya boleh mengirim realization (ditegakkan di Service); admin/hrd
// boleh juga mengubah indicator/target/weight.
const updateDetailValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("detailId").isUUID().withMessage("detailId tidak valid"),
  body("indicator").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("target")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("target harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("weight harus berupa angka dan tidak boleh negatif")
    .toFloat(),
  body("realization")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("realization harus berupa angka dan tidak boleh negatif")
    .toFloat(),
];

module.exports = {
  listValidation,
  summaryValidation,
  idParamValidation,
  detailIdParamValidation,
  createValidation,
  updateValidation,
  createDetailValidation,
  updateDetailValidation,
};
