const divisiRepository = require("./divisi.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeDivisi = (row) => ({
  id: row.id,
  namaDivisi: row.nama_divisi,
  deskripsi: row.deskripsi,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listDivisi = async ({ page, limit, search }) => {
  const { data, total } = await divisiRepository.findAll({ page, limit, search });
  return {
    divisi: data.map(sanitizeDivisi),
    pagination: { page, limit, total },
  };
};

const getDivisiById = async (id) => {
  const divisi = await divisiRepository.findById(id);
  if (!divisi) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }
  return sanitizeDivisi(divisi);
};

const createDivisi = async ({ namaDivisi, deskripsi }) => {
  const existing = await divisiRepository.findByNama(namaDivisi);
  if (existing) {
    throw new AppError("Nama divisi sudah terdaftar", 409);
  }

  try {
    const created = await divisiRepository.create({
      nama_divisi: namaDivisi,
      deskripsi: deskripsi || null,
    });
    logger.info("Divisi created", { divisiId: created.id });
    return sanitizeDivisi(created);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama divisi sudah terdaftar", 409);
    }
    throw err;
  }
};

const updateDivisi = async (id, { namaDivisi, deskripsi }) => {
  const existing = await divisiRepository.findById(id);
  if (!existing) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }

  if (namaDivisi !== undefined && namaDivisi !== existing.nama_divisi) {
    const conflict = await divisiRepository.findByNama(namaDivisi);
    if (conflict) {
      throw new AppError("Nama divisi sudah terdaftar", 409);
    }
  }

  const payload = {};
  if (namaDivisi !== undefined) {
    payload.nama_divisi = namaDivisi;
  }
  if (deskripsi !== undefined) {
    payload.deskripsi = deskripsi;
  }

  try {
    const updated = await divisiRepository.update(id, payload);
    logger.info("Divisi updated", { divisiId: id, fields: Object.keys(payload) });
    return sanitizeDivisi(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama divisi sudah terdaftar", 409);
    }
    throw err;
  }
};

const deleteDivisi = async (id) => {
  const existing = await divisiRepository.findById(id);
  if (!existing) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }

  const isInUse = await divisiRepository.hasPegawai(id);
  if (isInUse) {
    throw new AppError("Divisi masih digunakan oleh pegawai, tidak dapat dihapus", 409);
  }

  const deleted = await divisiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Divisi tidak ditemukan", 404);
  }
  logger.info("Divisi deleted", { divisiId: id });
};

module.exports = { listDivisi, getDivisiById, createDivisi, updateDivisi, deleteDivisi };
