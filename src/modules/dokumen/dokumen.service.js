const crypto = require("crypto");
const dokumenRepository = require("./dokumen.repository");
const dokumenStorage = require("./dokumen.storage");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// Postgres unique_violation SQLSTATE — used to map a version-number race
// condition to a clean 409 instead of a raw 500.
const isUniqueViolation = (err) => err?.code === "23505";

const sanitizeDokumen = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  kategoriDokumenId: row.kategori_dokumen_id,
  namaDokumen: row.nama_dokumen,
  namaFileAsli: row.nama_file_asli,
  bucket: row.bucket,
  mimeType: row.mime_type,
  ukuranFile: row.ukuran_file,
  diunggahOleh: row.diunggah_oleh,
  status: row.status,
  disetujuiOleh: row.disetujui_oleh,
  tanggalPersetujuan: row.tanggal_persetujuan,
  catatanApproval: row.catatan_approval,
  tanggalKedaluwarsa: row.tanggal_kedaluwarsa,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// FR-DOC-010: dokumen.status is only meaningful when its kategori is
// wajib_approval (non-NULL). Approve/reject is only valid while pending.
const ensurePendingApproval = (dokumen) => {
  if (dokumen.status === null) {
    throw new AppError("Dokumen ini tidak memerlukan approval (kategori tidak wajib approval)", 409);
  }
  if (dokumen.status !== "menunggu_persetujuan") {
    throw new AppError(`Dokumen sudah diproses (status saat ini: ${dokumen.status})`, 409);
  }
};

const sanitizeDokumenVersion = (row) => ({
  id: row.id,
  dokumenId: row.dokumen_id,
  nomorVersi: row.nomor_versi,
  namaFileAsli: row.nama_file_asli,
  bucket: row.bucket,
  mimeType: row.mime_type,
  ukuranFile: row.ukuran_file,
  diunggahOleh: row.diunggah_oleh,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await dokumenRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const listDokumen = async ({
  page,
  limit,
  pegawaiId,
  kategoriDokumenId,
  status,
  akanKedaluwarsa,
  requester,
}) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role !== "admin" && requester.role !== "hrd") {
    const ownPegawaiId = await dokumenRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { dokumen: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await dokumenRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    kategoriDokumenId,
    status,
    akanKedaluwarsa,
  });

  return { dokumen: data.map(sanitizeDokumen), pagination: { page, limit, total } };
};

const getDokumenById = async (id) => {
  const dokumen = await dokumenRepository.findById(id);
  if (!dokumen) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }
  return sanitizeDokumen(dokumen);
};

const createDokumen = async ({
  requester,
  pegawaiId,
  kategoriDokumenId,
  namaDokumen,
  tanggalKedaluwarsa,
  file,
}) => {
  if (!file) {
    throw new AppError("Berkas wajib diunggah", 422);
  }

  let targetPegawaiId;
  if (requester.role === "admin" || requester.role === "hrd") {
    const isPegawaiValid = await dokumenRepository.pegawaiExists(pegawaiId);
    if (!isPegawaiValid) {
      throw new AppError("Pegawai tidak ditemukan", 404);
    }
    targetPegawaiId = pegawaiId;
  } else {
    targetPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  const isKategoriValid = await dokumenRepository.kategoriDokumenExists(kategoriDokumenId);
  if (!isKategoriValid) {
    throw new AppError("Kategori dokumen tidak ditemukan", 404);
  }

  // FR-DOC-010: approval is triggered per-kategori, not per-uploader-role —
  // even an admin/hrd upload starts pending if the kategori requires it.
  const wajibApproval = await dokumenRepository.findKategoriDokumenWajibApproval(kategoriDokumenId);
  const initialStatus = wajibApproval ? "menunggu_persetujuan" : null;

  // Generated up front (not left to the DB default) so the Storage path can
  // be nested under it, keeping every version of a document — including
  // this first one — under the same pegawaiId/dokumenId folder.
  const dokumenId = crypto.randomUUID();

  const { bucket, filePath } = await dokumenStorage.uploadFile({
    pegawaiId: targetPegawaiId,
    dokumenId,
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  const created = await dokumenRepository.create({
    id: dokumenId,
    pegawai_id: targetPegawaiId,
    kategori_dokumen_id: kategoriDokumenId,
    nama_dokumen: namaDokumen,
    nama_file_asli: file.originalname,
    file_path: filePath,
    bucket,
    mime_type: file.mimetype,
    ukuran_file: file.size,
    diunggah_oleh: requester.id,
    status: initialStatus,
    tanggal_kedaluwarsa: tanggalKedaluwarsa || null,
  });

  try {
    await dokumenRepository.createVersion({
      dokumen_id: created.id,
      nomor_versi: 1,
      nama_file_asli: created.nama_file_asli,
      file_path: created.file_path,
      bucket: created.bucket,
      mime_type: created.mime_type,
      ukuran_file: created.ukuran_file,
      diunggah_oleh: requester.id,
    });
  } catch (err) {
    // The document itself was created successfully and is fully usable via
    // the existing endpoints regardless of this row — there is no
    // cross-table transaction available in this codebase, so history is
    // best-effort here rather than rolling back the whole upload.
    logger.error("Gagal membuat riwayat versi awal untuk dokumen baru", {
      dokumenId: created.id,
      error: err.message,
    });
  }

  logger.info("Dokumen uploaded", {
    dokumenId: created.id,
    pegawaiId: targetPegawaiId,
    actorId: requester.id,
  });
  return sanitizeDokumen(created);
};

const getDokumenDownloadUrl = async (id, { download } = {}) => {
  const dokumen = await dokumenRepository.findById(id);
  if (!dokumen) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }

  const { url, expiresIn } = await dokumenStorage.getSignedUrl(dokumen.file_path, {
    download: download ? dokumen.nama_file_asli : undefined,
  });

  return { url, expiresIn };
};

const getDokumenVersions = async (dokumenId, { page, limit }) => {
  const dokumen = await dokumenRepository.findById(dokumenId);
  if (!dokumen) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }

  const { data, total } = await dokumenRepository.findVersionsByDokumenId({ dokumenId, page, limit });
  return { versions: data.map(sanitizeDokumenVersion), pagination: { page, limit, total } };
};

const createDokumenVersion = async ({ dokumenId, requester, file }) => {
  if (!file) {
    throw new AppError("Berkas wajib diunggah", 422);
  }

  const dokumen = await dokumenRepository.findById(dokumenId);
  if (!dokumen) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }

  const nomorVersi = await dokumenRepository.getNextVersionNumber(dokumenId);

  const { bucket, filePath } = await dokumenStorage.uploadFile({
    pegawaiId: dokumen.pegawai_id,
    dokumenId,
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  let createdVersion;
  try {
    createdVersion = await dokumenRepository.createVersion({
      dokumen_id: dokumenId,
      nomor_versi: nomorVersi,
      nama_file_asli: file.originalname,
      file_path: filePath,
      bucket,
      mime_type: file.mimetype,
      ukuran_file: file.size,
      diunggah_oleh: requester.id,
    });
  } catch (err) {
    await dokumenStorage.removeFile(filePath).catch((cleanupErr) => {
      logger.error("Gagal membersihkan berkas Storage yatim setelah insert versi gagal", {
        filePath,
        error: cleanupErr.message,
      });
    });

    if (isUniqueViolation(err)) {
      throw new AppError("Nomor versi sedang diproses oleh permintaan lain, silakan coba lagi", 409);
    }
    throw err;
  }

  try {
    await dokumenRepository.updateDokumenActiveVersion(dokumenId, createdVersion);
  } catch (err) {
    await dokumenRepository.deleteVersionById(createdVersion.id).catch((cleanupErr) => {
      logger.error("Gagal membersihkan baris versi setelah update mirror gagal", {
        versionId: createdVersion.id,
        error: cleanupErr.message,
      });
    });
    await dokumenStorage.removeFile(filePath).catch((cleanupErr) => {
      logger.error("Gagal membersihkan berkas Storage setelah update mirror gagal", {
        filePath,
        error: cleanupErr.message,
      });
    });
    throw err;
  }

  // FR-DOC-010 (design decision): a new version on a wajib_approval dokumen
  // must be reviewed again — reset status and clear stale approval metadata
  // from whatever review cycle applied to the previous version. Best-effort:
  // the version upload itself has already succeeded and is not rolled back
  // if only this secondary bookkeeping update fails.
  if (dokumen.status !== null) {
    try {
      await dokumenRepository.update(dokumenId, {
        status: "menunggu_persetujuan",
        disetujui_oleh: null,
        tanggal_persetujuan: null,
        catatan_approval: null,
      });
    } catch (err) {
      logger.error("Gagal mereset status approval setelah unggah versi baru", {
        dokumenId,
        error: err.message,
      });
    }
  }

  logger.info("Dokumen version uploaded", {
    dokumenId,
    versionId: createdVersion.id,
    nomorVersi,
    actorId: requester.id,
  });

  return sanitizeDokumenVersion(createdVersion);
};

const getDokumenVersionDownloadUrl = async (dokumenId, versionId, { download } = {}) => {
  const dokumen = await dokumenRepository.findById(dokumenId);
  if (!dokumen) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }

  const version = await dokumenRepository.findVersionByDokumenIdAndId(dokumenId, versionId);
  if (!version) {
    throw new AppError("Versi dokumen tidak ditemukan", 404);
  }

  const { url, expiresIn } = await dokumenStorage.getSignedUrl(version.file_path, {
    download: download ? version.nama_file_asli : undefined,
  });

  return { url, expiresIn };
};

// Single-step approval, admin/hrd only — mirrors cuti.service.js's
// approveCuti exactly. Only valid while status is 'menunggu_persetujuan'
// (never for a dokumen whose kategori isn't wajib_approval, or one already
// decided).
const approveDokumen = async ({ id, approverId, catatanApproval }) => {
  const existing = await dokumenRepository.findById(id);
  if (!existing) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }
  ensurePendingApproval(existing);

  const updated = await dokumenRepository.update(id, {
    status: "disetujui",
    disetujui_oleh: approverId,
    tanggal_persetujuan: new Date().toISOString(),
    catatan_approval: catatanApproval || null,
  });
  logger.info("Dokumen approved", { dokumenId: id, approverId });
  return sanitizeDokumen(updated);
};

// Mirrors cuti.service.js's rejectCuti — catatanApproval is required here
// (enforced by dokumen.validation.js), unlike approve where it's optional.
const rejectDokumen = async ({ id, approverId, catatanApproval }) => {
  const existing = await dokumenRepository.findById(id);
  if (!existing) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }
  ensurePendingApproval(existing);

  const updated = await dokumenRepository.update(id, {
    status: "ditolak",
    disetujui_oleh: approverId,
    tanggal_persetujuan: new Date().toISOString(),
    catatan_approval: catatanApproval,
  });
  logger.info("Dokumen rejected", { dokumenId: id, approverId });
  return sanitizeDokumen(updated);
};

// Soft delete only — the underlying Storage file(s) and dokumen_version
// history rows are left untouched (recoverable), consistent with every
// other module's soft delete.
const deleteDokumen = async (id) => {
  const existing = await dokumenRepository.findById(id);
  if (!existing) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }

  const deleted = await dokumenRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Dokumen tidak ditemukan", 404);
  }
  logger.info("Dokumen deleted", { dokumenId: id });
};

module.exports = {
  listDokumen,
  getDokumenById,
  createDokumen,
  getDokumenDownloadUrl,
  getDokumenVersions,
  createDokumenVersion,
  getDokumenVersionDownloadUrl,
  approveDokumen,
  rejectDokumen,
  deleteDokumen,
};
