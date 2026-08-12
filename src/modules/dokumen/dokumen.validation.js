const { param, body, query } = require("express-validator");

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("kategoriDokumenId").optional().isUUID().withMessage("kategoriDokumenId tidak valid"),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

// Runs after `dokumen.upload.js` (multer) has already populated req.body's
// text fields from the multipart request, same ordering cuti/absensi use
// for their role-conditional pegawaiId rule.
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
  body("kategoriDokumenId").isUUID().withMessage("kategoriDokumenId wajib diisi dan berupa UUID"),
  body("namaDokumen")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("namaDokumen wajib diisi (maksimal 200 karakter)"),
];

const versiListValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

const versiIdParamValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  param("versionId").isUUID().withMessage("versionId tidak valid"),
];

module.exports = {
  listValidation,
  idParamValidation,
  createValidation,
  versiListValidation,
  versiIdParamValidation,
};
