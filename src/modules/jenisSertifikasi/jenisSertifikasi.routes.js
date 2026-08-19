const { Router } = require("express");
const controller = require("./jenisSertifikasi.controller");
const validation = require("./jenisSertifikasi.validation");
const validate = require("../../shared/validators/validate");
const authMiddleware = require("../../shared/middlewares/authMiddleware");
const authorize = require("../../shared/middlewares/authorize");

const router = Router();

router.use(authMiddleware);

// Read is open to every authenticated role (RLS: jenis_sertifikasi_select_authenticated).
router.get("/", validation.listValidation, validate, controller.list);
router.get("/:id", validation.idParamValidation, validate, controller.detail);

router.post("/", authorize("admin", "hrd"), validation.createValidation, validate, controller.create);
router.patch("/:id", authorize("admin", "hrd"), validation.updateValidation, validate, controller.update);

// Soft delete; blocked with 409 while any sertifikasi still references this
// jenis (see jenisSertifikasi.service.js).
router.delete("/:id", authorize("admin", "hrd"), validation.idParamValidation, validate, controller.remove);

module.exports = router;
