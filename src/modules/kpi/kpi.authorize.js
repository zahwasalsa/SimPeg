const kpiRepository = require("./kpi.repository");
const AppError = require("../../shared/exceptions/appError");

// Admin/HRD (or any role passed in `roles`) get access unconditionally.
// Everyone else only gets access if the kpi row at :id belongs to the
// pegawai profile linked to their own user_id. Used for GET detail, PATCH
// (self-input capaian), and the nested kpi_detail routes (which authorize
// against the parent :id before touching the detail row).
const authorizeKpiSelfOrRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (roles.includes(req.user.role)) {
        return next();
      }

      const kpi = await kpiRepository.findById(req.params.id);
      if (!kpi) {
        throw new AppError("Data KPI tidak ditemukan", 404);
      }

      const ownPegawaiId = await kpiRepository.findPegawaiIdByUserId(req.user.id);
      if (!ownPegawaiId || kpi.pegawai_id !== ownPegawaiId) {
        throw new AppError("Anda tidak memiliki akses untuk resource ini", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = authorizeKpiSelfOrRoles;
