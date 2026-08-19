const hkiRepository = require("./hki.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD/Pimpinan (or any role passed in `roles`) get access
// unconditionally. Everyone else only gets access if the hki row at :id
// belongs to the pegawai profile linked to their own user_id — ownership is
// hki.pegawai_id directly, never via the optional penelitian_id link (see
// hki.service.js's sanitizeHki comment). Used for GET detail, PATCH, DELETE.
const authorizeHkiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const hki = await hkiRepository.findById(req.params.id);
      if (!hki) {
        throw new AppError("Data HKI tidak ditemukan", 404);
      }

      const ownPegawaiId = await hkiRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || hki.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeHkiSelfOrRoles;
