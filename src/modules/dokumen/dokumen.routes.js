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

router.get(
  "/:id/versi",
  validation.idParamValidation,
  validate,
  dokumenAuthorize("admin", "hrd"),
  validation.versiListValidation,
  validate,
  controller.listVersi,
);

// Role gate first (rejects pimpinan outright, mirrors POST /), then ownership
// check on :id (rejects pegawai targeting someone else's dokumen) before the
// multipart body is even parsed.
router.post(
  "/:id/versi",
  authorize("admin", "hrd", "pegawai"),
  validation.idParamValidation,
  validate,
  dokumenAuthorize("admin", "hrd"),
  uploadSingleFile,
  controller.createVersi,
);

router.get(
  "/:id/versi/:versionId/download",
  validation.versiIdParamValidation,
  validate,
  dokumenAuthorize("admin", "hrd"),
  controller.downloadVersi,
);

module.exports = router;
