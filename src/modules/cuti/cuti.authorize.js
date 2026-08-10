const cutiRepository = require("./cuti.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the cuti row at :id belongs to the
// pegawai profile linked to their own user_id. Used for GET detail and the
// self-cancel action.
const authorizeCutiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const cuti = await cutiRepository.findById(req.params.id);
      if (!cuti) {
        throw new AppError("Data cuti tidak ditemukan", 404);
      }

      const ownPegawaiId = await cutiRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || cuti.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeCutiSelfOrRoles;
