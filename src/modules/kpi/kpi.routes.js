const { Router } = require("express");
const controller = require("./kpi.controller");
const validation = require("./kpi.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const kpiAuthorize = require("./kpi.authorize");

const router = Router();

router.use(authMiddleware);

// List is open to every role; scope (all vs own) is decided in the Service.
router.get("/", validation.listValidation, validate, controller.list);

// FR-KPI-006. Must be registered before "/:id" so Express doesn't treat
// "summary" as a KPI id.
router.get("/summary", validation.summaryValidation, validate, controller.summary);

router.get(
  "/:id",
  validation.idParamValidation,
  validate,
  kpiAuthorize("admin", "hrd", "pimpinan"),
  controller.detail,
);

// FR-KPI-001: HRD/Admin set the target. No self-service — matches the
// approved role design (pegawai never creates their own KPI record).
router.post("/", authorize("admin", "hrd"), validation.createValidation, validate, controller.create);

// FR-KPI-002: pegawai inputs achievement on their own record; admin/hrd may
// also correct target/period. Pimpinan is excluded at this role gate (view
// only), so even if a KPI row happened to belong to a pimpinan's own pegawai
// profile, they still cannot write to it.
router.patch(
  "/:id",
  authorize("admin", "hrd", "pegawai"),
  validation.updateValidation,
  validate,
  kpiAuthorize("admin", "hrd"),
  controller.update,
);

// Admin/HRD only — no self-delete.
router.delete("/:id", authorize("admin", "hrd"), validation.idParamValidation, validate, controller.remove);

// --- kpi_detail (rincian per indikator) ---

router.get(
  "/:id/detail",
  validation.idParamValidation,
  validate,
  kpiAuthorize("admin", "hrd", "pimpinan"),
  controller.listDetail,
);

// HRD/Admin only — mendefinisikan indikator baru pada sebuah KPI.
router.post(
  "/:id/detail",
  authorize("admin", "hrd"),
  validation.createDetailValidation,
  validate,
  controller.createDetail,
);

// Pegawai hanya boleh mengubah realization pada indikator KPI miliknya
// sendiri; admin/hrd boleh mengubah indicator/target/weight kapan pun.
router.patch(
  "/:id/detail/:detailId",
  authorize("admin", "hrd", "pegawai"),
  validation.updateDetailValidation,
  validate,
  kpiAuthorize("admin", "hrd"),
  controller.updateDetail,
);

// Admin/HRD only.
router.delete(
  "/:id/detail/:detailId",
  authorize("admin", "hrd"),
  validation.detailIdParamValidation,
  validate,
  controller.removeDetail,
);

module.exports = router;
