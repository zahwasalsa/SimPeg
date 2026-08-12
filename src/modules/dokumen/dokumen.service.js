const dokumenRepository = require("./dokumen.repository");
const dokumenStorage = require("./dokumen.storage");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

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

const listDokumen = async ({ page, limit, pegawaiId, kategoriDokumenId, requester }) => {
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

const createDokumen = async ({ requester, pegawaiId, kategoriDokumenId, namaDokumen, file }) => {
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

  const { bucket, filePath } = await dokumenStorage.uploadFile({
    pegawaiId: targetPegawaiId,
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
  });

  const created = await dokumenRepository.create({
    pegawai_id: targetPegawaiId,
    kategori_dokumen_id: kategoriDokumenId,
    nama_dokumen: namaDokumen,
    nama_file_asli: file.originalname,
    file_path: filePath,
    bucket,
    mime_type: file.mimetype,
    ukuran_file: file.size,
    diunggah_oleh: requester.id,
  });

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

module.exports = { listDokumen, getDokumenById, createDokumen, getDokumenDownloadUrl };
