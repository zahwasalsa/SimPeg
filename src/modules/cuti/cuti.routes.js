const { Router } = require("express");
const controller = require("./cuti.controller");
const validation = require("./cuti.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const cutiAuthorize = require("./cuti.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service.
router.get("/", validation.listValidation, validate, controller.list);

router.get("/:id", validation.idParamValidation, validate, cutiAuthorize("admin", "hrd"), controller.detail);

// Pimpinan is intentionally excluded — pegawai can only submit for themselves.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  validation.createValidation,
  validate,
  controller.create,
);

// Approve/reject: admin/hrd only, no self-service (per approved design).
router.patch(
  "/:id/approve",
  authorize("admin", "hrd"),
  validation.approveValidation,
  validate,
  controller.approve,
);

router.patch(
  "/:id/reject",
  authorize("admin", "hrd"),
  validation.rejectValidation,
  validate,
  controller.reject,
);

// Cancel: admin/hrd (any) or the owning pegawai, only while still 'diajukan'.
router.patch(
  "/:id/cancel",
  validation.idParamValidation,
  validate,
  cutiAuthorize("admin", "hrd"),
  controller.cancel,
);

// Soft delete; admin/hrd only, no self-service (pegawai already has "cancel"
// for their own pending requests). Any status may be deleted, unlike cancel
// which requires 'diajukan'.
router.delete("/:id", authorize("admin", "hrd"), validation.idParamValidation, validate, controller.remove);

module.exports = router;
