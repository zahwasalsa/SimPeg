const { param, body, query } = require("express-validator");

const JENIS_CUTI_VALUES = [
  "cuti_tahunan",
  "cuti_sakit",
  "cuti_melahirkan",
  "cuti_besar",
  "cuti_alasan_penting",
];
const STATUS_VALUES = ["diajukan", "disetujui", "ditolak", "dibatalkan"];

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
  query("jenisCuti").optional().isIn(JENIS_CUTI_VALUES).withMessage("jenisCuti tidak valid"),
];

const idParamValidation = [param("id").isUUID().withMessage("ID tidak valid")];

const createValidation = [
  // admin/hrd: pegawaiId wajib. pegawai: pegawaiId tidak boleh dikirim sama
  // sekali — identitas selalu diresolusi dari req.user.id di Service.
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
  body("jumlahHari").custom((value) => {
    if (value !== undefined) {
      throw new Error("jumlahHari dihitung otomatis, tidak boleh dikirim");
    }
    return true;
  }),
  body("jenisCuti").isIn(JENIS_CUTI_VALUES).withMessage("jenisCuti tidak valid"),
  body("tanggalMulai").isISO8601().withMessage("tanggalMulai wajib diisi, format YYYY-MM-DD"),
  body("tanggalSelesai").isISO8601().withMessage("tanggalSelesai wajib diisi, format YYYY-MM-DD"),
  body("alasan").optional({ nullable: true }).isString().withMessage("alasan harus berupa teks"),
];

const approveValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("catatanApproval")
    .optional({ nullable: true })
    .isString()
    .withMessage("catatanApproval harus berupa teks"),
];

const rejectValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("catatanApproval")
    .exists({ checkFalsy: true })
    .withMessage("catatanApproval wajib diisi saat menolak cuti")
    .bail()
    .isString()
    .withMessage("catatanApproval harus berupa teks"),
];

module.exports = {
  listValidation,
  idParamValidation,
  createValidation,
  approveValidation,
  rejectValidation,
};
