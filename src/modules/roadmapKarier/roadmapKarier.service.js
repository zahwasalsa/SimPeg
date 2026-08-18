const roadmapKarierRepository = require("./roadmapKarier.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// FR-CAREER-001..004. Unlike KPI, the blueprint's `career_roadmaps` draft
// gives no formula for `progress` (no `period`/target-vs-achievement pair to
// derive it from, and no FK to `kpi` either — see docs/database.md §14) and
// no ordering rule between the three `status` values, so there is no
// server-side calculation to centralize here the way kpi.service.js does.
// The business rule that *is* explicit and enforced here: only admin/HRD may
// ever write `progress`/`status` (pegawai is read-only for this whole
// module — blueprint only ever says pegawai "memantau", never inputs
// roadmap data), and both are range/enum-validated so they can't be set to
// nonsensical values even by admin/HRD.
const sanitizeRoadmapKarier = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  jabatanSaatIniId: row.jabatan_saat_ini_id,
  jabatanTargetId: row.jabatan_target_id,
  persyaratan: row.persyaratan,
  progress: Number(row.progress),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await roadmapKarierRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

// List is open to every role (route level); pegawai is always scoped to
// their own records, admin/hrd/pimpinan see everyone (optionally narrowed by
// pegawaiId) — same shape as kpi.service.js#listKpi.
const listRoadmapKarier = async ({ page, limit, pegawaiId, status, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    const ownPegawaiId = await roadmapKarierRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { roadmapKarier: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await roadmapKarierRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    status,
  });

  return { roadmapKarier: data.map(sanitizeRoadmapKarier), pagination: { page, limit, total } };
};

const getRoadmapKarierById = async (id) => {
  const roadmap = await roadmapKarierRepository.findById(id);
  if (!roadmap) {
    throw new AppError("Data roadmap karier tidak ditemukan", 404);
  }
  return sanitizeRoadmapKarier(roadmap);
};

// FR-CAREER-001/002: Admin/HRD only — pegawai never creates their own
// roadmap record (matches the KPI role design: target-setting is always
// staff-side, pegawai only ever monitors).
const createRoadmapKarier = async ({
  pegawaiId,
  jabatanSaatIniId,
  jabatanTargetId,
  persyaratan,
  progress,
  status,
}) => {
  const isPegawaiValid = await roadmapKarierRepository.pegawaiExists(pegawaiId);
  if (!isPegawaiValid) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  if (jabatanSaatIniId) {
    const isValid = await roadmapKarierRepository.jabatanExists(jabatanSaatIniId);
    if (!isValid) {
      throw new AppError("Jabatan saat ini tidak ditemukan", 404);
    }
  }

  if (jabatanTargetId) {
    const isValid = await roadmapKarierRepository.jabatanExists(jabatanTargetId);
    if (!isValid) {
      throw new AppError("Jabatan target tidak ditemukan", 404);
    }
  }

  const created = await roadmapKarierRepository.create({
    pegawai_id: pegawaiId,
    jabatan_saat_ini_id: jabatanSaatIniId || null,
    jabatan_target_id: jabatanTargetId || null,
    persyaratan: persyaratan || null,
    progress: progress === undefined ? 0 : progress,
    status: status || "in_progress",
  });
  logger.info("Roadmap karier created", { roadmapKarierId: created.id, pegawaiId });

  return sanitizeRoadmapKarier(created);
};

// Admin/HRD only (route-level authorize) — pegawai has no write path to this
// resource at all, so there is no self-editable-field split to enforce here
// the way kpi.service.js#updateKpi does for achievement.
const updateRoadmapKarier = async (id, input) => {
  const existing = await roadmapKarierRepository.findById(id);
  if (!existing) {
    throw new AppError("Data roadmap karier tidak ditemukan", 404);
  }

  if (input.jabatanSaatIniId) {
    const isValid = await roadmapKarierRepository.jabatanExists(input.jabatanSaatIniId);
    if (!isValid) {
      throw new AppError("Jabatan saat ini tidak ditemukan", 404);
    }
  }

  if (input.jabatanTargetId) {
    const isValid = await roadmapKarierRepository.jabatanExists(input.jabatanTargetId);
    if (!isValid) {
      throw new AppError("Jabatan target tidak ditemukan", 404);
    }
  }

  const payload = {};
  if (input.jabatanSaatIniId !== undefined) payload.jabatan_saat_ini_id = input.jabatanSaatIniId;
  if (input.jabatanTargetId !== undefined) payload.jabatan_target_id = input.jabatanTargetId;
  if (input.persyaratan !== undefined) payload.persyaratan = input.persyaratan;
  if (input.progress !== undefined) payload.progress = input.progress;
  if (input.status !== undefined) payload.status = input.status;

  let updated = existing;
  if (Object.keys(payload).length > 0) {
    updated = await roadmapKarierRepository.update(id, payload);
    logger.info("Roadmap karier updated", { roadmapKarierId: id, fields: Object.keys(payload) });
  }

  return sanitizeRoadmapKarier(updated);
};

const deleteRoadmapKarier = async (id) => {
  const existing = await roadmapKarierRepository.findById(id);
  if (!existing) {
    throw new AppError("Data roadmap karier tidak ditemukan", 404);
  }

  const deleted = await roadmapKarierRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data roadmap karier tidak ditemukan", 404);
  }
  logger.info("Roadmap karier deleted", { roadmapKarierId: id });
};

module.exports = {
  listRoadmapKarier,
  getRoadmapKarierById,
  createRoadmapKarier,
  updateRoadmapKarier,
  deleteRoadmapKarier,
  resolveOwnPegawaiId,
};
