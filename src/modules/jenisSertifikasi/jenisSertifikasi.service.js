const jenisSertifikasiRepository = require("./jenisSertifikasi.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeJenisSertifikasi = (row) => ({
  id: row.id,
  namaJenis: row.nama_jenis,
  deskripsi: row.deskripsi,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listJenisSertifikasi = async ({ page, limit, search }) => {
  const { data, total } = await jenisSertifikasiRepository.findAll({ page, limit, search });
  return {
    jenisSertifikasi: data.map(sanitizeJenisSertifikasi),
    pagination: { page, limit, total },
  };
};

const getJenisSertifikasiById = async (id) => {
  const jenis = await jenisSertifikasiRepository.findById(id);
  if (!jenis) {
    throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
  }
  return sanitizeJenisSertifikasi(jenis);
};

const createJenisSertifikasi = async ({ namaJenis, deskripsi }) => {
  const existing = await jenisSertifikasiRepository.findByNama(namaJenis);
  if (existing) {
    throw new AppError("Nama jenis sertifikasi sudah terdaftar", 409);
  }

  try {
    const created = await jenisSertifikasiRepository.create({
      nama_jenis: namaJenis,
      deskripsi: deskripsi || null,
    });
    logger.info("Jenis sertifikasi created", { jenisSertifikasiId: created.id });
    return sanitizeJenisSertifikasi(created);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama jenis sertifikasi sudah terdaftar", 409);
    }
    throw err;
  }
};

const updateJenisSertifikasi = async (id, { namaJenis, deskripsi }) => {
  const existing = await jenisSertifikasiRepository.findById(id);
  if (!existing) {
    throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
  }

  if (namaJenis !== undefined && namaJenis !== existing.nama_jenis) {
    const conflict = await jenisSertifikasiRepository.findByNama(namaJenis);
    if (conflict) {
      throw new AppError("Nama jenis sertifikasi sudah terdaftar", 409);
    }
  }

  const payload = {};
  if (namaJenis !== undefined) {
    payload.nama_jenis = namaJenis;
  }
  if (deskripsi !== undefined) {
    payload.deskripsi = deskripsi;
  }

  try {
    const updated = await jenisSertifikasiRepository.update(id, payload);
    logger.info("Jenis sertifikasi updated", { jenisSertifikasiId: id, fields: Object.keys(payload) });
    return sanitizeJenisSertifikasi(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama jenis sertifikasi sudah terdaftar", 409);
    }
    throw err;
  }
};

const deleteJenisSertifikasi = async (id) => {
  const existing = await jenisSertifikasiRepository.findById(id);
  if (!existing) {
    throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
  }

  const isInUse = await jenisSertifikasiRepository.hasSertifikasi(id);
  if (isInUse) {
    throw new AppError("Jenis sertifikasi masih digunakan oleh data sertifikasi, tidak dapat dihapus", 409);
  }

  const deleted = await jenisSertifikasiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Jenis sertifikasi tidak ditemukan", 404);
  }
  logger.info("Jenis sertifikasi deleted", { jenisSertifikasiId: id });
};

module.exports = {
  listJenisSertifikasi,
  getJenisSertifikasiById,
  createJenisSertifikasi,
  updateJenisSertifikasi,
  deleteJenisSertifikasi,
};
