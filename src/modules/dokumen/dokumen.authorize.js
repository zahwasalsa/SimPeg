const dokumenRepository = require("./dokumen.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the dokumen row at :id belongs to the
// pegawai profile linked to their own user_id. Used for detail and download.
const authorizeDokumenSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        next();
        return;
      }

      const dokumen = await dokumenRepository.findById(req.params.id);
      if (!dokumen) {
        throw new AppError("Dokumen tidak ditemukan", 404);
      }

      const ownPegawaiId = await dokumenRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || dokumen.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeDokumenSelfOrRoles;
