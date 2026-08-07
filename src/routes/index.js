const { Router } = require("express");
const authRoutes = require("../modules/auth/auth.routes");
const usersRoutes = require("../modules/users/users.routes");
const pegawaiRoutes = require("../modules/pegawai/pegawai.routes");
const divisiRoutes = require("../modules/divisi/divisi.routes");
const jabatanRoutes = require("../modules/jabatan/jabatan.routes");
const absensiRoutes = require("../modules/absensi/absensi.routes");

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/pegawai", pegawaiRoutes);
router.use("/divisi", divisiRoutes);
router.use("/jabatan", jabatanRoutes);
router.use("/absensi", absensiRoutes);

module.exports = router;
