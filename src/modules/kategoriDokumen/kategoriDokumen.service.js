const kategoriDokumenRepository = require("./kategoriDokumen.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeKategoriDokumen = (row) => ({
  id: row.id,
  namaKategori: row.nama_kategori,
  deskripsi: row.deskripsi,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listKategoriDokumen = async ({ page, limit, search }) => {
  const { data, total } = await kategoriDokumenRepository.findAll({ page, limit, search });
  return {
    kategoriDokumen: data.map(sanitizeKategoriDokumen),
    pagination: { page, limit, total },
  };
};

const getKategoriDokumenById = async (id) => {
  const kategori = await kategoriDokumenRepository.findById(id);
  if (!kategori) {
    throw new AppError("Kategori dokumen tidak ditemukan", 404);
  }
  return sanitizeKategoriDokumen(kategori);
};

const createKategoriDokumen = async ({ namaKategori, deskripsi }) => {
  const existing = await kategoriDokumenRepository.findByNama(namaKategori);
  if (existing) {
    throw new AppError("Nama kategori sudah terdaftar", 409);
  }

  try {
    const created = await kategoriDokumenRepository.create({
      nama_kategori: namaKategori,
      deskripsi: deskripsi || null,
    });
    logger.info("Kategori dokumen created", { kategoriDokumenId: created.id });
    return sanitizeKategoriDokumen(created);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama kategori sudah terdaftar", 409);
    }
    throw err;
  }
};

const updateKategoriDokumen = async (id, { namaKategori, deskripsi }) => {
  const existing = await kategoriDokumenRepository.findById(id);
  if (!existing) {
    throw new AppError("Kategori dokumen tidak ditemukan", 404);
  }

  if (namaKategori !== undefined && namaKategori !== existing.nama_kategori) {
    const conflict = await kategoriDokumenRepository.findByNama(namaKategori);
    if (conflict) {
      throw new AppError("Nama kategori sudah terdaftar", 409);
    }
  }

  const payload = {};
  if (namaKategori !== undefined) {
    payload.nama_kategori = namaKategori;
  }
  if (deskripsi !== undefined) {
    payload.deskripsi = deskripsi;
  }

  try {
    const updated = await kategoriDokumenRepository.update(id, payload);
    logger.info("Kategori dokumen updated", { kategoriDokumenId: id, fields: Object.keys(payload) });
    return sanitizeKategoriDokumen(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Nama kategori sudah terdaftar", 409);
    }
    throw err;
  }
};

module.exports = {
  listKategoriDokumen,
  getKategoriDokumenById,
  createKategoriDokumen,
  updateKategoriDokumen,
};
