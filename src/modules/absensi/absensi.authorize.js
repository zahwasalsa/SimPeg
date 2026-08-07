const absensiRepository = require("./absensi.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the absensi row at :id belongs to the
// pegawai profile linked to their own user_id. Mirrors pegawai.authorize.js,
// but absensi is owned via pegawai_id, so the caller's own pegawai.id must
// be resolved first before comparing.
const authorizeAbsensiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const absensi = await absensiRepository.findById(req.params.id);
      if (!absensi) {
        throw new AppError("Data absensi tidak ditemukan", 404);
      }

      const ownPegawaiId = await absensiRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || absensi.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeAbsensiSelfOrRoles;
