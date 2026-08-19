const penelitianRepository = require("./penelitian.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the penelitian row at :id belongs to the
// pegawai profile linked to their own user_id. Used for GET detail, PATCH,
// DELETE, and every nested anggota_penelitian/publikasi route (which
// authorize against the parent :id — the penelitian id — before touching the
// child row), mirroring kpi.authorize.js exactly.
const authorizePenelitianSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const penelitian = await penelitianRepository.findById(req.params.id);
      if (!penelitian) {
        throw new AppError("Data penelitian tidak ditemukan", 404);
      }

      const ownPegawaiId = await penelitianRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || penelitian.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizePenelitianSelfOrRoles;
