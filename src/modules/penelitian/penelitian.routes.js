const { Router } = require("express");
const controller = require("./penelitian.controller");
const validation = require("./penelitian.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const penelitianAuthorize = require("./penelitian.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service —
// same pattern as GET /kpi and GET /roadmap-karier.
router.get("/", validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd", "pimpinan"),
  controller.detail,
);

// FR-RES-001: self-service. Admin/HRD may create on behalf of any pegawai;
// pegawai always creates their own (pegawaiId is rejected by validation for
// that role). Pimpinan is excluded — read-only.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  validation.createValidation,
  validate,
  controller.create,
);

// Admin/HRD unconditional; pegawai only their own record (full CRUD per the
// approved role design — unlike kpi/roadmap_karier). Pimpinan excluded.
router.patch(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.updateValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.update,
);

// Admin/HRD unconditional; pegawai may delete their own record (full CRUD).
// Pimpinan excluded.
router.delete(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.idParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.remove,
);

// --- anggota_penelitian (anggota tim tambahan di luar pengusul) ---

router.get(
  "/:id/anggota",
  validation.idParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd", "pimpinan"),
  controller.listAnggota,
);

router.post(
  "/:id/anggota",
  authorize("admin", "hrd", "pegawai"),
  validation.createAnggotaValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.createAnggota,
);

router.delete(
  "/:id/anggota/:anggotaId",
  authorize("admin", "hrd", "pegawai"),
  validation.anggotaIdParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.removeAnggota,
);

// --- publikasi ---

router.get(
  "/:id/publikasi",
  validation.idParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd", "pimpinan"),
  controller.listPublikasi,
);

router.post(
  "/:id/publikasi",
  authorize("admin", "hrd", "pegawai"),
  validation.createPublikasiValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.createPublikasi,
);

router.patch(
  "/:id/publikasi/:publikasiId",
  authorize("admin", "hrd", "pegawai"),
  validation.updatePublikasiValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.updatePublikasi,
);

router.delete(
  "/:id/publikasi/:publikasiId",
  authorize("admin", "hrd", "pegawai"),
  validation.publikasiIdParamValidation,
  validate,
  penelitianAuthorize("admin", "hrd"),
  controller.removePublikasi,
);

module.exports = router;
