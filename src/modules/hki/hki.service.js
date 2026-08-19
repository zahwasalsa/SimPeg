const hkiRepository = require("./hki.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// FR-RES-004. hki.pegawai_id is a direct ownership column (not derived via
// penelitian_id, which is optional) — matches the RLS design in
// 048_rls_policies_hki.sql and docs/database.md §15's design note.
const sanitizeHki = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  penelitianId: row.penelitian_id,
  judul: row.judul,
  jenis: row.jenis,
  nomorPendaftaran: row.nomor_pendaftaran,
  tanggalPendaftaran: row.tanggal_pendaftaran,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await hkiRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const isPrivileged = (role) => role === "admin" || role === "hrd";

// List is open to every role (route level); pegawai is always scoped to
// their own records, admin/hrd/pimpinan see everyone (optionally narrowed by
// pegawaiId/penelitianId) — same shape as kpi.service.js#listKpi.
const listHki = async ({ page, limit, pegawaiId, penelitianId, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    const ownPegawaiId = await hkiRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { hki: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await hkiRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    penelitianId,
  });

  return { hki: data.map(sanitizeHki), pagination: { page, limit, total } };
};

const getHkiById = async (id) => {
  const hki = await hkiRepository.findById(id);
  if (!hki) {
    throw new AppError("Data HKI tidak ditemukan", 404);
  }
  return sanitizeHki(hki);
};

// Admin/HRD may create on behalf of any pegawai (pegawaiId required); pegawai
// self-reports and can only ever create their own — mirrors
// penelitian.service.js#createPenelitian / dokumen.service.js#createDokumen.
const createHki = async ({
  requester,
  pegawaiId,
  penelitianId,
  judul,
  jenis,
  nomorPendaftaran,
  tanggalPendaftaran,
}) => {
  let targetPegawaiId;
  if (isPrivileged(requester.role)) {
    const isPegawaiValid = await hkiRepository.pegawaiExists(pegawaiId);
    if (!isPegawaiValid) {
      throw new AppError("Pegawai tidak ditemukan", 404);
    }
    targetPegawaiId = pegawaiId;
  } else {
    targetPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  if (penelitianId) {
    const isOwned = await hkiRepository.penelitianOwnedBy(penelitianId, targetPegawaiId);
    if (!isOwned) {
      throw new AppError("Penelitian tidak ditemukan atau bukan milik pegawai ini", 404);
    }
  }

  const created = await hkiRepository.create({
    pegawai_id: targetPegawaiId,
    penelitian_id: penelitianId || null,
    judul,
    jenis: jenis || null,
    nomor_pendaftaran: nomorPendaftaran || null,
    tanggal_pendaftaran: tanggalPendaftaran || null,
  });
  logger.info("HKI created", { hkiId: created.id, pegawaiId: targetPegawaiId });

  return sanitizeHki(created);
};

// Ownership already enforced at the route level (hki.authorize.js); admin/hrd
// and the owning pegawai may edit the same fields.
const updateHki = async (id, input) => {
  const existing = await hkiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data HKI tidak ditemukan", 404);
  }

  if (input.penelitianId !== undefined && input.penelitianId !== null) {
    const isOwned = await hkiRepository.penelitianOwnedBy(input.penelitianId, existing.pegawai_id);
    if (!isOwned) {
      throw new AppError("Penelitian tidak ditemukan atau bukan milik pegawai ini", 404);
    }
  }

  const payload = {};
  if (input.penelitianId !== undefined) payload.penelitian_id = input.penelitianId;
  if (input.judul !== undefined) payload.judul = input.judul;
  if (input.jenis !== undefined) payload.jenis = input.jenis;
  if (input.nomorPendaftaran !== undefined) payload.nomor_pendaftaran = input.nomorPendaftaran;
  if (input.tanggalPendaftaran !== undefined) payload.tanggal_pendaftaran = input.tanggalPendaftaran;

  let updated = existing;
  if (Object.keys(payload).length > 0) {
    updated = await hkiRepository.update(id, payload);
    logger.info("HKI updated", { hkiId: id, fields: Object.keys(payload) });
  }

  return sanitizeHki(updated);
};

const deleteHki = async (id) => {
  const existing = await hkiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data HKI tidak ditemukan", 404);
  }

  const deleted = await hkiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data HKI tidak ditemukan", 404);
  }
  logger.info("HKI deleted", { hkiId: id });
};

module.exports = {
  listHki,
  getHkiById,
  createHki,
  updateHki,
  deleteHki,
  resolveOwnPegawaiId,
};
