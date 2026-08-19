const { Router } = require("express");
const controller = require("./sertifikasi.controller");
const validation = require("./sertifikasi.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const sertifikasiAuthorize = require("./sertifikasi.authorize");
const { uploadSingleFile } = require("./sertifikasi.upload");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service —
// same pattern as GET /kpi and GET /penelitian.
router.get("/", validation.listValidation, validate, controller.list);

// Pimpinan gets unconditional read access for oversight (FR-DASH/blueprint
// §8 "Pimpinan memantau perkembangan SDM") — same as kpi/penelitian, unlike
// dokumen's narrower personal-document interpretation.
router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  sertifikasiAuthorize("admin", "hrd", "pimpinan"),
  controller.detail,
);

router.get(
  "/:id/download",
  validation.idParamValidation,
  validate,
  sertifikasiAuthorize("admin", "hrd", "pimpinan"),
  controller.download,
);

// FR-CERT-001/002: self-service, satu langkah (create + upload berkas
// sekaligus). Admin/HRD boleh membuat atas nama pegawai mana pun; pegawai
// selalu membuat miliknya sendiri (pegawaiId ditolak validasi untuk role
// ini). Pimpinan dikecualikan — read-only.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  uploadSingleFile,
  validation.createValidation,
  validate,
  controller.create,
);

// Admin/HRD unconditional; pegawai hanya sertifikasi miliknya sendiri (full
// CRUD, sama seperti dokumen/penelitian/hki — bukan pola kpi/roadmap_karier).
// Metadata only, tidak ada penggantian berkas.
router.patch(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.updateValidation,
  validate,
  sertifikasiAuthorize("admin", "hrd"),
  controller.update,
);

// Admin/HRD unconditional; pegawai boleh menghapus sertifikasi miliknya
// sendiri. Pimpinan dikecualikan.
router.delete(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.idParamValidation,
  validate,
  sertifikasiAuthorize("admin", "hrd"),
  controller.remove,
);

module.exports = router;
