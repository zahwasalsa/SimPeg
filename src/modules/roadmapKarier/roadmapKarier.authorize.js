const roadmapKarierRepository = require("./roadmapKarier.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD/Pimpinan (or any role passed in `roles`) get access
// unconditionally. Everyone else (pegawai) only gets access if the
// roadmap_karier row at :id belongs to the pegawai profile linked to their
// own user_id. Used for GET detail only — pegawai has no write path to this
// resource at all (create/update/delete are gated to admin/hrd directly at
// the route level, no self-or-roles check needed there).
const authorizeRoadmapKarierSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const roadmap = await roadmapKarierRepository.findById(req.params.id);
      if (!roadmap) {
        throw new AppError("Data roadmap karier tidak ditemukan", 404);
      }

      const ownPegawaiId = await roadmapKarierRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || roadmap.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeRoadmapKarierSelfOrRoles;
