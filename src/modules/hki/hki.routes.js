const { Router } = require("express");
const controller = require("./hki.controller");
const validation = require("./hki.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const hkiAuthorize = require("./hki.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service —
// same pattern as GET /kpi and GET /penelitian.
router.get("/", validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  hkiAuthorize("admin", "hrd", "pimpinan"),
  controller.detail,
);

// FR-RES-004: self-service. Admin/HRD may create on behalf of any pegawai;
// pegawai always creates their own (pegawaiId is rejected by validation for
// that role). Pimpinan is excluded — read-only.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  validation.createValidation,
  validate,
  controller.create,
);

// Admin/HRD unconditional; pegawai only their own record (full CRUD, matches
// penelitian's role design). Pimpinan excluded.
router.patch(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.updateValidation,
  validate,
  hkiAuthorize("admin", "hrd"),
  controller.update,
);

// Admin/HRD unconditional; pegawai may delete their own record. Pimpinan
// excluded.
router.delete(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.idParamValidation,
  validate,
  hkiAuthorize("admin", "hrd"),
  controller.remove,
);

module.exports = router;
