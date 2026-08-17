const { Router } = require("express");
const authRoutes = require("../modules/auth/auth.routes");
const usersRoutes = require("../modules/users/users.routes");
const pegawaiRoutes = require("../modules/pegawai/pegawai.routes");
const divisiRoutes = require("../modules/divisi/divisi.routes");
const jabatanRoutes = require("../modules/jabatan/jabatan.routes");
const absensiRoutes = require("../modules/absensi/absensi.routes");
const cutiRoutes = require("../modules/cuti/cuti.routes");
const kategoriDokumenRoutes = require("../modules/kategoriDokumen/kategoriDokumen.routes");
const dokumenRoutes = require("../modules/dokumen/dokumen.routes");
const kpiRoutes = require("../modules/kpi/kpi.routes");

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/pegawai", pegawaiRoutes);
router.use("/divisi", divisiRoutes);
router.use("/jabatan", jabatanRoutes);
router.use("/absensi", absensiRoutes);
router.use("/cuti", cutiRoutes);
router.use("/kategori-dokumen", kategoriDokumenRoutes);
router.use("/dokumen", dokumenRoutes);
router.use("/kpi", kpiRoutes);

module.exports = router;
