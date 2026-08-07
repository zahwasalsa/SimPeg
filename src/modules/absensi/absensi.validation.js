const { param, body, query } = require("express-validator");

const STATUS_VALUES = ["hadir", "izin", "sakit", "alpha", "cuti"];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const listValidation = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("pegawaiId").optional().isUUID().withMessage("pegawaiId tidak valid"),
  query("tanggal").optional().isISO8601().withMessage("tanggal harus format YYYY-MM-DD"),
  query("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
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
  body("tanggal").isISO8601().withMessage("tanggal wajib diisi, format YYYY-MM-DD"),
  body("jamMasuk")
    .optional({ nullable: true })
    .matches(TIME_REGEX)
    .withMessage("jamMasuk harus format HH:mm"),
  body("jamKeluar")
    .optional({ nullable: true })
    .matches(TIME_REGEX)
    .withMessage("jamKeluar harus format HH:mm"),
  body("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
  body("keterangan").optional({ nullable: true }).isString().withMessage("keterangan harus berupa teks"),
];

const updateValidation = [
  param("id").isUUID().withMessage("ID tidak valid"),
  body("pegawaiId").not().exists().withMessage("pegawaiId tidak boleh diubah"),
  body("tanggal").optional().isISO8601().withMessage("tanggal harus format YYYY-MM-DD"),
  body("jamMasuk")
    .optional({ nullable: true })
    .matches(TIME_REGEX)
    .withMessage("jamMasuk harus format HH:mm"),
  body("jamKeluar")
    .optional({ nullable: true })
    .matches(TIME_REGEX)
    .withMessage("jamKeluar harus format HH:mm"),
  body("status").optional().isIn(STATUS_VALUES).withMessage("status tidak valid"),
  body("keterangan").optional({ nullable: true }).isString().withMessage("keterangan harus berupa teks"),
];

module.exports = { listValidation, idParamValidation, createValidation, updateValidation };
