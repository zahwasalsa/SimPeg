const pegawaiRepository = require("./pegawai.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// Never include anything from `users` (email, password_hash, etc.) here.
const sanitizePegawai = (row) => ({
  id: row.id,
  userId: row.user_id,
  divisiId: row.divisi_id,
  jabatanId: row.jabatan_id,
  nip: row.nip,
  namaLengkap: row.nama_lengkap,
  jenisKelamin: row.jenis_kelamin,
  tempatLahir: row.tempat_lahir,
  tanggalLahir: row.tanggal_lahir,
  alamat: row.alamat,
  noTelepon: row.no_telepon,
  tanggalMasuk: row.tanggal_masuk,
  statusKepegawaian: row.status_kepegawaian,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listPegawai = async ({ page, limit, search, divisiId, jabatanId, status }) => {
  const { data, total } = await pegawaiRepository.findAll({
    page,
    limit,
    search,
    divisiId,
    jabatanId,
    status,
  });
  return {
    pegawai: data.map(sanitizePegawai),
    pagination: { page, limit, total },
  };
};

const getPegawaiById = async (id) => {
  const pegawai = await pegawaiRepository.findById(id);
  if (!pegawai) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }
  return sanitizePegawai(pegawai);
};

const createPegawai = async (input) => {
  const isUserValid = await pegawaiRepository.userExists(input.userId);
  if (!isUserValid) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const existingPegawai = await pegawaiRepository.findByUserId(input.userId);
  if (existingPegawai) {
    throw new AppError("User ini sudah memiliki profil pegawai", 409);
  }

  const existingNip = await pegawaiRepository.findByNip(input.nip);
  if (existingNip) {
    throw new AppError("NIP sudah terdaftar", 409);
  }

  if (input.divisiId) {
    const isDivisiValid = await pegawaiRepository.divisiExists(input.divisiId);
    if (!isDivisiValid) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  if (input.jabatanId) {
    const isJabatanValid = await pegawaiRepository.jabatanExists(input.jabatanId);
    if (!isJabatanValid) {
      throw new AppError("Jabatan tidak ditemukan", 404);
    }
  }

  const payload = {
    user_id: input.userId,
    divisi_id: input.divisiId || null,
    jabatan_id: input.jabatanId || null,
    nip: input.nip,
    nama_lengkap: input.namaLengkap,
    jenis_kelamin: input.jenisKelamin || null,
    tempat_lahir: input.tempatLahir || null,
    tanggal_lahir: input.tanggalLahir || null,
    alamat: input.alamat || null,
    no_telepon: input.noTelepon || null,
    tanggal_masuk: input.tanggalMasuk || null,
    status_kepegawaian: input.statusKepegawaian || "aktif",
  };

  try {
    const created = await pegawaiRepository.create(payload);
    logger.info("Pegawai created", { pegawaiId: created.id, userId: input.userId });
    return sanitizePegawai(created);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Data pegawai duplikat (userId atau NIP sudah terpakai)", 409);
    }
    throw err;
  }
};

// Fields a pegawai/pimpinan may change on their own profile — personal
// contact/biodata only. Organizational fields (nip, namaLengkap, divisiId,
// jabatanId, statusKepegawaian) stay admin/hrd-only, since those affect
// official records, not just the individual's own information.
const SELF_EDITABLE_FIELDS = ["jenisKelamin", "tempatLahir", "tanggalLahir", "alamat", "noTelepon"];

const updatePegawai = async (id, input, requester) => {
  const isPrivileged = requester.role === "admin" || requester.role === "hrd";

  if (!isPrivileged) {
    const disallowed = Object.keys(input).filter(
      (key) => input[key] !== undefined && !SELF_EDITABLE_FIELDS.includes(key),
    );
    if (disallowed.length > 0) {
      throw new AppError(`Field berikut hanya dapat diubah oleh admin/HRD: ${disallowed.join(", ")}`, 403);
    }
  }

  const existing = await pegawaiRepository.findById(id);
  if (!existing) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  if (input.nip !== undefined && input.nip !== existing.nip) {
    const existingNip = await pegawaiRepository.findByNip(input.nip);
    if (existingNip) {
      throw new AppError("NIP sudah terdaftar", 409);
    }
  }

  if (input.divisiId) {
    const isDivisiValid = await pegawaiRepository.divisiExists(input.divisiId);
    if (!isDivisiValid) {
      throw new AppError("Divisi tidak ditemukan", 404);
    }
  }

  if (input.jabatanId) {
    const isJabatanValid = await pegawaiRepository.jabatanExists(input.jabatanId);
    if (!isJabatanValid) {
      throw new AppError("Jabatan tidak ditemukan", 404);
    }
  }

  const payload = {};
  if (input.nip !== undefined) payload.nip = input.nip;
  if (input.namaLengkap !== undefined) payload.nama_lengkap = input.namaLengkap;
  if (input.divisiId !== undefined) payload.divisi_id = input.divisiId;
  if (input.jabatanId !== undefined) payload.jabatan_id = input.jabatanId;
  if (input.jenisKelamin !== undefined) payload.jenis_kelamin = input.jenisKelamin;
  if (input.tempatLahir !== undefined) payload.tempat_lahir = input.tempatLahir;
  if (input.tanggalLahir !== undefined) payload.tanggal_lahir = input.tanggalLahir;
  if (input.alamat !== undefined) payload.alamat = input.alamat;
  if (input.noTelepon !== undefined) payload.no_telepon = input.noTelepon;
  if (input.tanggalMasuk !== undefined) payload.tanggal_masuk = input.tanggalMasuk;
  if (input.statusKepegawaian !== undefined) payload.status_kepegawaian = input.statusKepegawaian;

  try {
    const updated = await pegawaiRepository.update(id, payload);
    logger.info("Pegawai updated", { pegawaiId: id, fields: Object.keys(payload) });
    return sanitizePegawai(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("NIP sudah terdaftar", 409);
    }
    throw err;
  }
};

const deletePegawai = async (id) => {
  const existing = await pegawaiRepository.findById(id);
  if (!existing) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  const deleted = await pegawaiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }
  logger.info("Pegawai deleted", { pegawaiId: id });
};

module.exports = { listPegawai, getPegawaiById, createPegawai, updatePegawai, deletePegawai };
