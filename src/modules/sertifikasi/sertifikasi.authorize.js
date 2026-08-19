const sertifikasiRepository = require("./sertifikasi.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the sertifikasi row at :id belongs to
// the pegawai profile linked to their own user_id. Used for GET detail,
// download, PATCH, and DELETE — mirrors dokumen.authorize.js /
// penelitian.authorize.js exactly.
const authorizeSertifikasiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const sertifikasi = await sertifikasiRepository.findById(req.params.id);
      if (!sertifikasi) {
        throw new AppError("Data sertifikasi tidak ditemukan", 404);
      }

      const ownPegawaiId = await sertifikasiRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || sertifikasi.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeSertifikasiSelfOrRoles;
