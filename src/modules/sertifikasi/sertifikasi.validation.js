const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("jenisSertifikasiId").optional().isUUID().withMessage("jenisSertifikasiId tidak valid"),
  query("akanBerakhir").optional().isBoolean().withMessage("akanBerakhir harus boolean").toBoolean(),
  query("kedaluwarsa").optional().isBoolean().withMessage("kedaluwarsa harus boolean").toBoolean(),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

// Runs after `sertifikasi.upload.js` (multer) has already populated req.body's
// text fields from the multipart request, same ordering dokumen.validation.js
// uses for its role-conditional pegawaiId rule.
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
  body("jenisSertifikasiId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("jenisSertifikasiId tidak valid"),
  body("namaSertifikat")
    .isString()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage("namaSertifikat wajib diisi (maksimal 300 karakter)"),
  body("penerbit").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body("nomorSertifikat").optional({ nullable: true }).isString().trim().isLength({ max: 150 }),
  body("tanggalTerbit")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalTerbit harus format tanggal valid (YYYY-MM-DD)"),
  body("tanggalBerakhir")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalBerakhir harus format tanggal valid (YYYY-MM-DD)"),
];

// pegawaiId tidak boleh diubah setelah dibuat — sama seperti kpi/roadmap_
// karier/penelitian/hki. Tidak ada field berkas di sini (metadata only).
const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("jenisSertifikasiId")
    .optional({ nullable: true })
    .isUUID()
    .withMessage("jenisSertifikasiId tidak valid"),
  body("namaSertifikat").optional().isString().trim().isLength({ min: 1, max: 300 }),
  body("penerbit").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body("nomorSertifikat").optional({ nullable: true }).isString().trim().isLength({ max: 150 }),
  body("tanggalTerbit")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalTerbit harus format tanggal valid (YYYY-MM-DD)"),
  body("tanggalBerakhir")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("tanggalBerakhir harus format tanggal valid (YYYY-MM-DD)"),
];

module.exports = { listValidation, idParamValidation, createValidation, updateValidation };
