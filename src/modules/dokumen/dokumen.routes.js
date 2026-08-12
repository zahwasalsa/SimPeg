const { Router } = require("express");
const controller = require("./dokumen.controller");
const validation = require("./dokumen.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const dokumenAuthorize = require("./dokumen.authorize");
const { uploadSingleFile } = require("./dokumen.upload");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service.
router.get("/", validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  dokumenAuthorize("admin", "hrd"),
  controller.detail,
);

router.get(
  "/:id/download",
  validation.idParamValidation,
  validate,
  dokumenAuthorize("admin", "hrd"),
  controller.download,
);

// Pimpinan is intentionally excluded — mirrors absensi/cuti self-service create.
router.post(
  "/",
  authorize("admin", "hrd", "pegawai"),
  uploadSingleFile,
  validation.createValidation,
  validate,
  controller.create,
);

module.exports = router;
