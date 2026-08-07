const jabatanRepository = require("./jabatan.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeJabatan = (row) => ({
  id: row.id,
  namaJabatan: row.nama_jabatan,
  deskripsi: row.deskripsi,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listJabatan = async ({ page, limit, search }) => {
  const { data, total } = await jabatanRepository.findAll({ page, limit, search });
  return {
    jabatan: data.map(sanitizeJabatan),
    pagination: { page, limit, total },
  };
};

const getJabatanById = async (id) => {
  const jabatan = await jabatanRepository.findById(id);
  if (!jabatan) {
    throw new AppError("Jabatan tidak ditemukan", 404);
  }
  return sanitizeJabatan(jabatan);
};

const createJabatan = async ({ namaJabatan, deskripsi }) => {
  const existing = await jabatanRepository.findByNama(namaJabatan);
  if (existing) {
    throw new AppError("Nama jabatan sudah terdaftar", 409);
  }

  try {
    const created = await jabatanRepository.create({
      nama_jabatan: namaJabatan,
      deskripsi: deskripsi || null,
    });
    logger.info("Jabatan created", { jabatanId: created.id });
    return sanitizeJabatan(created);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama jabatan sudah terdaftar", 409);
    }
    throw err;
  }
};

const updateJabatan = async (id, { namaJabatan, deskripsi }) => {
  const existing = await jabatanRepository.findById(id);
  if (!existing) {
    throw new AppError("Jabatan tidak ditemukan", 404);
  }

  if (namaJabatan !== undefined && namaJabatan !== existing.nama_jabatan) {
    const conflict = await jabatanRepository.findByNama(namaJabatan);
    if (conflict) {
      throw new AppError("Nama jabatan sudah terdaftar", 409);
    }
  }

  const payload = {};
  if (namaJabatan !== undefined) {
    payload.nama_jabatan = namaJabatan;
  }
  if (deskripsi !== undefined) {
    payload.deskripsi = deskripsi;
  }

  try {
    const updated = await jabatanRepository.update(id, payload);
    logger.info("Jabatan updated", { jabatanId: id, fields: Object.keys(payload) });
    return sanitizeJabatan(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama jabatan sudah terdaftar", 409);
    }
    throw err;
  }
};

module.exports = { listJabatan, getJabatanById, createJabatan, updateJabatan };
