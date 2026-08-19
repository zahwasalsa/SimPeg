const penelitianRepository = require("./penelitian.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// FR-RES-001..003: unlike kpi/roadmap_karier (admin/HRD assigns a target to a
// pegawai), penelitian is self-reported by the pegawai who proposes/owns it —
// see docs/database.md §15's "Catatan desain". Admin/HRD retain full CRUD for
// oversight/correction; pegawai gets full CRUD on their own record only.
const sanitizePenelitian = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  judul: row.judul,
  skema: row.skema,
  dana: row.dana === null ? null : Number(row.dana),
  tahun: row.tahun,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeAnggota = (row) => ({
  id: row.id,
  penelitianId: row.penelitian_id,
  pegawaiId: row.pegawai_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizePublikasi = (row) => ({
  id: row.id,
  penelitianId: row.penelitian_id,
  judul: row.judul,
  jurnal: row.jurnal,
  terindeks: row.terindeks,
  tahun: row.tahun,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await penelitianRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const isPrivileged = (role) => role === "admin" || role === "hrd";

// List is open to every role (route level); pegawai is always scoped to
// their own records, admin/hrd/pimpinan see everyone (optionally narrowed by
// pegawaiId/tahun) — same shape as kpi.service.js#listKpi.
const listPenelitian = async ({ page, limit, pegawaiId, tahun, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    const ownPegawaiId = await penelitianRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { penelitian: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await penelitianRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    tahun,
  });

  return { penelitian: data.map(sanitizePenelitian), pagination: { page, limit, total } };
};

// Embeds anggota[]/publikasi[] (two extra queries) so callers get the full
// picture in one call — matches kpi.service.js#getKpiById's reasoning for why
// this is only done on the detail endpoint, not the list.
const getPenelitianById = async (id) => {
  const penelitian = await penelitianRepository.findById(id);
  if (!penelitian) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }
  const [anggota, publikasi] = await Promise.all([
    penelitianRepository.findAnggotaByPenelitianId(id),
    penelitianRepository.findPublikasiByPenelitianId(id),
  ]);
  return {
    ...sanitizePenelitian(penelitian),
    anggota: anggota.map(sanitizeAnggota),
    publikasi: publikasi.map(sanitizePublikasi),
  };
};

// Admin/HRD may create on behalf of any pegawai (pegawaiId required); pegawai
// self-reports and can only ever create their own (pegawaiId is rejected by
// validation for that role — see penelitian.validation.js), mirroring
// dokumen.service.js#createDokumen exactly.
const createPenelitian = async ({ requester, pegawaiId, judul, skema, dana, tahun }) => {
  let targetPegawaiId;
  if (isPrivileged(requester.role)) {
    const isPegawaiValid = await penelitianRepository.pegawaiExists(pegawaiId);
    if (!isPegawaiValid) {
      throw new AppError("Pegawai tidak ditemukan", 404);
    }
    targetPegawaiId = pegawaiId;
  } else {
    targetPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  const created = await penelitianRepository.create({
    pegawai_id: targetPegawaiId,
    judul,
    skema: skema || null,
    dana: dana === undefined ? null : dana,
    tahun,
  });
  logger.info("Penelitian created", { penelitianId: created.id, pegawaiId: targetPegawaiId });

  return sanitizePenelitian(created);
};

// Ownership already enforced at the route level (penelitian.authorize.js);
// admin/hrd and the owning pegawai may edit the same fields — no
// self-editable-field split needed here (unlike kpi, where pegawai/admin can
// only touch different fields of the same record).
const updatePenelitian = async (id, input) => {
  const existing = await penelitianRepository.findById(id);
  if (!existing) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }

  const payload = {};
  if (input.judul !== undefined) payload.judul = input.judul;
  if (input.skema !== undefined) payload.skema = input.skema;
  if (input.dana !== undefined) payload.dana = input.dana;
  if (input.tahun !== undefined) payload.tahun = input.tahun;

  let updated = existing;
  if (Object.keys(payload).length > 0) {
    updated = await penelitianRepository.update(id, payload);
    logger.info("Penelitian updated", { penelitianId: id, fields: Object.keys(payload) });
  }

  return sanitizePenelitian(updated);
};

// Soft delete only, ownership enforced at the route level. Mirrors
// dokumen.service.js#deleteDokumen: child rows (anggota_penelitian,
// publikasi) are left untouched/recoverable, not cascade-soft-deleted.
const deletePenelitian = async (id) => {
  const existing = await penelitianRepository.findById(id);
  if (!existing) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }

  const deleted = await penelitianRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }
  logger.info("Penelitian deleted", { penelitianId: id });
};

// --- anggota_penelitian ---

const listAnggota = async (penelitianId) => {
  const penelitian = await penelitianRepository.findById(penelitianId);
  if (!penelitian) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }
  const rows = await penelitianRepository.findAnggotaByPenelitianId(penelitianId);
  return rows.map(sanitizeAnggota);
};

const createAnggota = async (penelitianId, { pegawaiId }) => {
  const penelitian = await penelitianRepository.findById(penelitianId);
  if (!penelitian) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }

  const isPegawaiValid = await penelitianRepository.pegawaiExists(pegawaiId);
  if (!isPegawaiValid) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  let created;
  try {
    created = await penelitianRepository.createAnggota({
      penelitian_id: penelitianId,
      pegawai_id: pegawaiId,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Pegawai ini sudah menjadi anggota penelitian ini", 409);
    }
    throw err;
  }
  logger.info("Anggota penelitian created", { anggotaId: created.id, penelitianId, pegawaiId });
  return sanitizeAnggota(created);
};

const deleteAnggota = async (penelitianId, anggotaId) => {
  const existing = await penelitianRepository.findAnggotaById(anggotaId);
  if (!existing || existing.penelitian_id !== penelitianId) {
    throw new AppError("Anggota penelitian tidak ditemukan", 404);
  }

  const deleted = await penelitianRepository.softDeleteAnggota(anggotaId);
  if (!deleted) {
    throw new AppError("Anggota penelitian tidak ditemukan", 404);
  }
  logger.info("Anggota penelitian deleted", { anggotaId, penelitianId });
};

// --- publikasi ---

const listPublikasi = async (penelitianId) => {
  const penelitian = await penelitianRepository.findById(penelitianId);
  if (!penelitian) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }
  const rows = await penelitianRepository.findPublikasiByPenelitianId(penelitianId);
  return rows.map(sanitizePublikasi);
};

const createPublikasi = async (penelitianId, { judul, jurnal, terindeks, tahun }) => {
  const penelitian = await penelitianRepository.findById(penelitianId);
  if (!penelitian) {
    throw new AppError("Data penelitian tidak ditemukan", 404);
  }

  const created = await penelitianRepository.createPublikasi({
    penelitian_id: penelitianId,
    judul,
    jurnal: jurnal || null,
    terindeks: terindeks === undefined ? false : terindeks,
    tahun,
  });
  logger.info("Publikasi created", { publikasiId: created.id, penelitianId });
  return sanitizePublikasi(created);
};

const updatePublikasi = async (penelitianId, publikasiId, input) => {
  const existing = await penelitianRepository.findPublikasiById(publikasiId);
  if (!existing || existing.penelitian_id !== penelitianId) {
    throw new AppError("Publikasi tidak ditemukan", 404);
  }

  const payload = {};
  if (input.judul !== undefined) payload.judul = input.judul;
  if (input.jurnal !== undefined) payload.jurnal = input.jurnal;
  if (input.terindeks !== undefined) payload.terindeks = input.terindeks;
  if (input.tahun !== undefined) payload.tahun = input.tahun;

  let updated = existing;
  if (Object.keys(payload).length > 0) {
    updated = await penelitianRepository.updatePublikasi(publikasiId, payload);
    logger.info("Publikasi updated", { publikasiId, penelitianId, fields: Object.keys(payload) });
  }

  return sanitizePublikasi(updated);
};

const deletePublikasi = async (penelitianId, publikasiId) => {
  const existing = await penelitianRepository.findPublikasiById(publikasiId);
  if (!existing || existing.penelitian_id !== penelitianId) {
    throw new AppError("Publikasi tidak ditemukan", 404);
  }

  const deleted = await penelitianRepository.softDeletePublikasi(publikasiId);
  if (!deleted) {
    throw new AppError("Publikasi tidak ditemukan", 404);
  }
  logger.info("Publikasi deleted", { publikasiId, penelitianId });
};

module.exports = {
  listPenelitian,
  getPenelitianById,
  createPenelitian,
  updatePenelitian,
  deletePenelitian,
  listAnggota,
  createAnggota,
  deleteAnggota,
  listPublikasi,
  createPublikasi,
  updatePublikasi,
  deletePublikasi,
  resolveOwnPegawaiId,
};
