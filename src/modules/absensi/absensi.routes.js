const { Router } = require("express");
const controller = require("./absensi.controller");
const validation = require("./absensi.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const absensiAuthorize = require("./absensi.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service.
router.get("/", validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  absensiAuthorize("admin", "hrd"),
  controller.detail,
);

// Pimpinan is intentionally excluded here.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  validation.createValidation,
  validate,
  controller.create,
);

router.patch("/:id", authorize("admin", "hrd"), validation.updateValidation, validate, controller.update);

module.exports = router;
