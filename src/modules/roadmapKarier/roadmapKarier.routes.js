const { Router } = require("express");
const controller = require("./roadmapKarier.controller");
const validation = require("./roadmapKarier.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const roadmapKarierAuthorize = require("./roadmapKarier.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service —
// same pattern as GET /kpi.
router.get("/", validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  roadmapKarierAuthorize("admin", "hrd", "pimpinan"),
  controller.detail,
);

// FR-CAREER-001/002: HRD/Admin set posisi saat ini/target. No self-service —
// pegawai never creates their own roadmap record.
router.post("/", authorize("admin", "hrd"), validation.createValidation, validate, controller.create);

// Admin/HRD only — pegawai has no write path to this resource at all
// (blueprint only ever describes pegawai "memantau", never inputting data).
router.patch("/:id", authorize("admin", "hrd"), validation.updateValidation, validate, controller.update);

// Admin/HRD only — no self-delete.
router.delete("/:id", authorize("admin", "hrd"), validation.idParamValidation, validate, controller.remove);

module.exports = router;
