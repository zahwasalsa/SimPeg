const { Router } = require("express");
const authRoutes = require("../modules/auth/auth.routes");
const usersRoutes = require("../modules/users/users.routes");
const pegawaiRoutes = require("../modules/pegawai/pegawai.routes");

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/pegawai", pegawaiRoutes);

module.exports = router;
