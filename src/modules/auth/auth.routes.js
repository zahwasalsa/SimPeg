const { Router } = require("express");
const controller = require("./auth.controller");
const validation = require("./auth.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");

const router = Router();

router.post("/register", validation.registerValidation, validate, controller.register);
router.post("/login", validation.loginValidation, validate, controller.login);
router.post("/logout", authMiddleware, controller.logout);
router.get("/me", authMiddleware, controller.me);
router.post("/refresh", validation.refreshValidation, validate, controller.refresh);

module.exports = router;
