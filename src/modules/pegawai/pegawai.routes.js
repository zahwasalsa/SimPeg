const { Router } = require("express");
const controller = require("./pegawai.controller");
const validation = require("./pegawai.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const authorizePegawaiSelfOrRoles = require("./pegawai.authorize");

const router = Router();

router.use(authMiddleware);

router.get("/", authorize("admin", "hrd"), validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  authorizePegawaiSelfOrRoles("admin", "hrd"),
  controller.detail,
);

router.post("/", authorize("admin", "hrd"), validation.createValidation, validate, controller.create);

// Self-service: pegawai/pimpinan may update their own profile (restricted to
// personal fields — see pegawai.service.js), admin/hrd may update anyone
// and any field.
router.patch(
  "/:id",
  validation.updateValidation,
  validate,
  authorizePegawaiSelfOrRoles("admin", "hrd"),
  controller.update,
);

// Admin/HRD only — no self-delete. Soft delete (sets deleted_at); the row
// is hidden from every existing query but not physically removed.
router.delete("/:id", authorize("admin", "hrd"), validation.idParamValidation, validate, controller.remove);

module.exports = router;
