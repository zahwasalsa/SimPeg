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

router.post("/", authorize("admin"), validation.createValidation, validate, controller.create);

router.get(
  "/:id",
  authorizeSelfOrRoles("id", "admin"),
  validation.idParamValidation,
  validate,
  controller.detail,
);

// Admin only. Writes auth.users.email (source of truth for login) and
// public.users.email together — see users.service.js#changeEmail for the
// sync/rollback behavior between the two.
router.patch("/:id/email", authorize("admin"), validation.emailValidation, validate, controller.changeEmail);

// Admin only. Sets the account's login password directly via Supabase Auth
// — never touches public.users (password_hash is unused/legacy there).
router.patch(
  "/:id/password",
  authorize("admin"),
  validation.passwordValidation,
  validate,
  controller.changePassword,
);

router.patch("/:id/role", authorize("admin"), validation.roleValidation, validate, controller.changeRole);

router.patch(
  "/:id/status",
  authorize("admin"),
  validation.statusValidation,
  validate,
  controller.changeStatus,
);

// Soft delete; admin only. Self-delete is blocked in the Service (400).
router.delete("/:id", authorize("admin"), validation.idParamValidation, validate, controller.remove);

module.exports = router;
