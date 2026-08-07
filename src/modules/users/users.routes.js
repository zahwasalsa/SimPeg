const { Router } = require("express");
const controller = require("./users.controller");
const validation = require("./users.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");
const authorizeSelfOrRoles = require("../../shared/middlewares/authorizeSelfOrRoles");

const router = Router();

router.use(authMiddleware);

router.get("/", authorize("admin"), validation.listValidation, validate, controller.list);

router.get(
  "/:id",
  authorizeSelfOrRoles("id", "admin"),
  validation.idParamValidation,
  validate,
  controller.detail,
);

router.patch("/:id/role", authorize("admin"), validation.roleValidation, validate, controller.changeRole);

router.patch(
  "/:id/status",
  authorize("admin"),
  validation.statusValidation,
  validate,
  controller.changeStatus,
);

module.exports = router;
