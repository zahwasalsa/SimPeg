const pegawaiRepository = require("./pegawai.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the pegawai row at :id belongs to them
// (pegawai.user_id === req.user.id). Unlike users' authorizeSelfOrRoles, the
// :id here is pegawai.id, not users.id, so a plain param/user-id string
// comparison isn't possible — the target row must be fetched first.
const authorizePegawaiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const pegawai = await pegawaiRepository.findById(req.params.id);
      if (!pegawai) {
        throw new AppError("Pegawai tidak ditemukan", 404);
      }

      if (pegawai.user_id !== req.user.id) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizePegawaiSelfOrRoles;
