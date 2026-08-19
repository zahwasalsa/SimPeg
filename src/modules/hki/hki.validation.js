const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("penelitianId").optional().isUUID().withMessage("penelitianId tidak valid"),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

// pegawaiId hanya boleh dikirim oleh admin/hrd (menunjuk pegawai lain);
// pegawai selalu membuat HKI miliknya sendiri (ditegakkan di Service) —
// mengikuti pola dokumen.validation.js#createValidation persis. penelitianId
// opsional (nullable) — lihat 043_hki.sql: HKI tidak selalu lahir dari satu
// proyek penelitian tercatat.
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
  body("penelitianId").optional({ nullable: true }).isUUID().withMessage("penelitianId tidak valid"),
  body("judul").isString().trim().isLength({ min: 1, max: 300 }).withMessage("judul wajib diisi"),
  body("jenis").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("nomorPendaftaran").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("tanggalPendaftaran")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalPendaftaran harus format tanggal valid (YYYY-MM-DD)"),
];

// pegawaiId tidak boleh diubah setelah dibuat — sama seperti kpi/roadmap_
// karier/penelitian.
const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("penelitianId").optional({ nullable: true }).isUUID().withMessage("penelitianId tidak valid"),
  body("judul").optional().isString().trim().isLength({ min: 1, max: 300 }),
  body("jenis").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("nomorPendaftaran").optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body("tanggalPendaftaran")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalPendaftaran harus format tanggal valid (YYYY-MM-DD)"),
];

module.exports = {
  listValidation,
  idParamValidation,
  createValidation,
  updateValidation,
};
