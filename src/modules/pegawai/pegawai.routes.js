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

router.patch("/:id", authorize("admin", "hrd"), validation.updateValidation, validate, controller.update);

module.exports = router;
