const crypto = require("crypto");
const sertifikasiRepository = require("./sertifikasi.repository");
const sertifikasiStorage = require("./sertifikasi.storage");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// FR-CERT-001..004: unlike kpi/roadmap_karier (admin/HRD assigns a target to
// a pegawai), sertifikasi is self-reported by the pegawai it belongs to —
// mirrors dokumen/penelitian/hki's ownership pattern. file_path is never
// exposed to the client (only used server-side to generate signed URLs),
// matching dokumen.service.js#sanitizeDokumen.
const sanitizeSertifikasi = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  jenisSertifikasiId: row.jenis_sertifikasi_id,
  namaSertifikat: row.nama_sertifikat,
  penerbit: row.penerbit,
  nomorSertifikat: row.nomor_sertifikat,
  tanggalTerbit: row.tanggal_terbit,
  tanggalBerakhir: row.tanggal_berakhir,
  namaFileAsli: row.nama_file_asli,
  bucket: row.bucket,
  mimeType: row.mime_type,
  ukuranFile: row.ukuran_file,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await sertifikasiRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const isPrivileged = (role) => role === "admin" || role === "hrd";

// List is open to every role (route level); pegawai is always scoped to
// their own records, admin/hrd/pimpinan see everyone (optionally narrowed by
// pegawaiId/jenisSertifikasiId/akanBerakhir/kedaluwarsa) — same shape as
// kpi.service.js#listKpi.
const listSertifikasi = async ({
  page,
  limit,
  pegawaiId,
  jenisSertifikasiId,
  akanBerakhir,
  kedaluwarsa,
  requester,
}) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    const ownPegawaiId = await sertifikasiRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { sertifikasi: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await sertifikasiRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    jenisSertifikasiId,
    akanBerakhir,
    kedaluwarsa,
  });

  return { sertifikasi: data.map(sanitizeSertifikasi), pagination: { page, limit, total } };
};

const getSertifikasiById = async (id) => {
  const sertifikasi = await sertifikasiRepository.findById(id);
  if (!sertifikasi) {
    throw new AppError("Data sertifikasi tidak ditemukan", 404);
  }
  return sanitizeSertifikasi(sertifikasi);
};

// Admin/HRD may create on behalf of any pegawai (pegawaiId required); pegawai
// self-reports and can only ever create their own — mirrors
// dokumen.service.js#createDokumen / penelitian.service.js#createPenelitian.
// Berkas wajib diunggah bersamaan (FR-CERT-001+002 satu langkah, bukan dua),
// lihat docs/database.md §16 untuk alasan lengkap.
const createSertifikasi = async ({
  requester,
  pegawaiId,
  jenisSertifikasiId,
  namaSertifikat,
  penerbit,
  nomorSertifikat,
  tanggalTerbit,
  tanggalBerakhir,
  file,
}) => {
  if (!file) {
    throw new AppError("Berkas sertifikat wajib diunggah", 422);
  }

  let targetPegawaiId;
  if (isPrivileged(requester.role)) {
    const isPegawaiValid = await sertifikasiRepository.pegawaiExists(pegawaiId);
    if (!isPegawaiValid) {
      throw new AppError("Pegawai tidak ditemukan", 404);
    }
    targetPegawaiId = pegawaiId;
  } else {
    targetPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  if (jenisSertifikasiId) {
    const isValid = await sertifikasiRepository.jenisSertifikasiExists(jenisSertifikasiId);
    if (!isValid) {
      throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
    }
  }

  // Generated up front (not left to the DB default) so the Storage path can
  // be nested under it — mirrors dokumen.service.js#createDokumen.
  const sertifikasiId = crypto.randomUUID();

  const { bucket, filePath } = await sertifikasiStorage.uploadFile({
    pegawaiId: targetPegawaiId,
    sertifikasiId,
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  let created;
  try {
    created = await sertifikasiRepository.create({
      id: sertifikasiId,
      pegawai_id: targetPegawaiId,
      jenis_sertifikasi_id: jenisSertifikasiId || null,
      nama_sertifikat: namaSertifikat,
      penerbit: penerbit || null,
      nomor_sertifikat: nomorSertifikat || null,
      tanggal_terbit: tanggalTerbit || null,
      tanggal_berakhir: tanggalBerakhir || null,
      nama_file_asli: file.originalname,
      file_path: filePath,
      bucket,
      mime_type: file.mimetype,
      ukuran_file: file.size,
    });
  } catch (err) {
    await sertifikasiStorage.removeFile(filePath).catch((cleanupErr) => {
      logger.error("Gagal membersihkan berkas Storage yatim setelah insert sertifikasi gagal", {
        filePath,
        error: cleanupErr.message,
      });
    });
    throw err;
  }

  logger.info("Sertifikasi created", { sertifikasiId: created.id, pegawaiId: targetPegawaiId });
  return sanitizeSertifikasi(created);
};

// Ownership already enforced at the route level (sertifikasi.authorize.js).
// Metadata only — tidak ada penggantian berkas di sini (FR-CERT tidak pernah
// menyebut re-upload/versi untuk sertifikat; untuk mengganti berkas, buat
// data sertifikasi baru). pegawaiId tidak pernah diubah di sini.
const updateSertifikasi = async (id, input) => {
  const existing = await sertifikasiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data sertifikasi tidak ditemukan", 404);
  }

  if (input.jenisSertifikasiId !== undefined && input.jenisSertifikasiId !== null) {
    const isValid = await sertifikasiRepository.jenisSertifikasiExists(input.jenisSertifikasiId);
    if (!isValid) {
      throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
    }
  }

  const payload = {};
  if (input.jenisSertifikasiId !== undefined) payload.jenis_sertifikasi_id = input.jenisSertifikasiId;
  if (input.namaSertifikat !== undefined) payload.nama_sertifikat = input.namaSertifikat;
  if (input.penerbit !== undefined) payload.penerbit = input.penerbit;
  if (input.nomorSertifikat !== undefined) payload.nomor_sertifikat = input.nomorSertifikat;
  if (input.tanggalTerbit !== undefined) payload.tanggal_terbit = input.tanggalTerbit;
  if (input.tanggalBerakhir !== undefined) payload.tanggal_berakhir = input.tanggalBerakhir;

  let updated = existing;
  if (Object.keys(payload).length > 0) {
    updated = await sertifikasiRepository.update(id, payload);
    logger.info("Sertifikasi updated", { sertifikasiId: id, fields: Object.keys(payload) });
  }

  return sanitizeSertifikasi(updated);
};

const getSertifikasiDownloadUrl = async (id, { download } = {}) => {
  const sertifikasi = await sertifikasiRepository.findById(id);
  if (!sertifikasi) {
    throw new AppError("Data sertifikasi tidak ditemukan", 404);
  }

  const { url, expiresIn } = await sertifikasiStorage.getSignedUrl(sertifikasi.file_path, {
    download: download ? sertifikasi.nama_file_asli : undefined,
  });

  return { url, expiresIn };
};

// Soft delete only, ownership enforced at the route level. Berkas di Storage
// sengaja ditinggalkan (recoverable) — mengikuti pola dokumen.service.js#deleteDokumen.
const deleteSertifikasi = async (id) => {
  const existing = await sertifikasiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data sertifikasi tidak ditemukan", 404);
  }

  const deleted = await sertifikasiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data sertifikasi tidak ditemukan", 404);
  }
  logger.info("Sertifikasi deleted", { sertifikasiId: id });
};

module.exports = {
  listSertifikasi,
  getSertifikasiById,
  createSertifikasi,
  updateSertifikasi,
  getSertifikasiDownloadUrl,
  deleteSertifikasi,
  resolveOwnPegawaiId,
};
