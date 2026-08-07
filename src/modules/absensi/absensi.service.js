const absensiRepository = require("./absensi.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeAbsensi = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  tanggal: row.tanggal,
  jamMasuk: row.jam_masuk,
  jamKeluar: row.jam_keluar,
  status: row.status,
  keterangan: row.keterangan,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateJamRange = (jamMasuk, jamKeluar) => {
  if (jamMasuk && jamKeluar && jamKeluar < jamMasuk) {
    throw new AppError("jamKeluar harus lebih besar atau sama dengan jamMasuk", 422);
  }
};

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await absensiRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const listAbsensi = async ({ page, limit, pegawaiId, tanggal, status, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role !== "admin" && requester.role !== "hrd") {
    const ownPegawaiId = await absensiRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { absensi: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await absensiRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    tanggal,
    status,
  });

  return { absensi: data.map(sanitizeAbsensi), pagination: { page, limit, total } };
};

const getAbsensiById = async (id) => {
  const absensi = await absensiRepository.findById(id);
  if (!absensi) {
    throw new AppError("Data absensi tidak ditemukan", 404);
  }
  return sanitizeAbsensi(absensi);
};

// Strict create-only, used when admin/hrd manages absensi on behalf of a
// pegawai they explicitly specify.
const createAbsensiAsStaff = async ({ pegawaiId, tanggal, jamMasuk, jamKeluar, status, keterangan }) => {
  const isPegawaiValid = await absensiRepository.pegawaiExists(pegawaiId);
  if (!isPegawaiValid) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  const existing = await absensiRepository.findByPegawaiAndTanggal(pegawaiId, tanggal);
  if (existing) {
    throw new AppError("Absensi untuk pegawai dan tanggal tersebut sudah ada", 409);
  }

  validateJamRange(jamMasuk, jamKeluar);

  try {
    const created = await absensiRepository.create({
      pegawai_id: pegawaiId,
      tanggal,
      jam_masuk: jamMasuk || null,
      jam_keluar: jamKeluar || null,
      status: status || "hadir",
      keterangan: keterangan || null,
    });
    logger.info("Absensi created (admin/hrd)", { absensiId: created.id, pegawaiId });
    return { data: sanitizeAbsensi(created), statusCode: 201 };
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Absensi untuk pegawai dan tanggal tersebut sudah ada", 409);
    }
    if (err.code === "23514") {
      throw new AppError("jamKeluar harus lebih besar atau sama dengan jamMasuk", 422);
    }
    throw err;
  }
};

// Self-service check-in / check-out. Identity is always resolved from the
// caller's own JWT (requesterId -> users.id), never trusted from the body.
const createOrCheckoutAsPegawai = async ({
  requesterId,
  tanggal,
  jamMasuk,
  jamKeluar,
  status,
  keterangan,
}) => {
  const pegawaiId = await resolveOwnPegawaiId(requesterId);
  const existing = await absensiRepository.findByPegawaiAndTanggal(pegawaiId, tanggal);

  if (!existing) {
    validateJamRange(jamMasuk, jamKeluar);
    try {
      const created = await absensiRepository.create({
        pegawai_id: pegawaiId,
        tanggal,
        jam_masuk: jamMasuk || null,
        jam_keluar: jamKeluar || null,
        status: status || "hadir",
        keterangan: keterangan || null,
      });
      logger.info("Absensi check-in", { absensiId: created.id, pegawaiId });
      return { data: sanitizeAbsensi(created), statusCode: 201 };
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("Absensi untuk tanggal tersebut sudah ada", 409);
      }
      if (err.code === "23514") {
        throw new AppError("jamKeluar harus lebih besar atau sama dengan jamMasuk", 422);
      }
      throw err;
    }
  }

  if (existing.jam_keluar) {
    throw new AppError("Absensi untuk tanggal tersebut sudah lengkap (check-in dan check-out)", 409);
  }

  const effectiveJamMasuk = jamMasuk !== undefined ? jamMasuk : existing.jam_masuk;
  const effectiveJamKeluar = jamKeluar !== undefined ? jamKeluar : existing.jam_keluar;
  validateJamRange(effectiveJamMasuk, effectiveJamKeluar);

  const payload = {};
  if (jamMasuk !== undefined) {
    payload.jam_masuk = jamMasuk;
  }
  if (jamKeluar !== undefined) {
    payload.jam_keluar = jamKeluar;
  }
  if (status !== undefined) {
    payload.status = status;
  }
  if (keterangan !== undefined) {
    payload.keterangan = keterangan;
  }

  try {
    const updated = await absensiRepository.update(existing.id, payload);
    logger.info("Absensi check-out", { absensiId: existing.id, pegawaiId });
    return { data: sanitizeAbsensi(updated), statusCode: 200 };
  } catch (err) {
    if (err.code === "23514") {
      throw new AppError("jamKeluar harus lebih besar atau sama dengan jamMasuk", 422);
    }
    throw err;
  }
};

const createAbsensi = async ({ requester, pegawaiId, tanggal, jamMasuk, jamKeluar, status, keterangan }) => {
  if (requester.role === "admin" || requester.role === "hrd") {
    return createAbsensiAsStaff({ pegawaiId, tanggal, jamMasuk, jamKeluar, status, keterangan });
  }
  return createOrCheckoutAsPegawai({
    requesterId: requester.id,
    tanggal,
    jamMasuk,
    jamKeluar,
    status,
    keterangan,
  });
};

const updateAbsensi = async (id, { tanggal, jamMasuk, jamKeluar, status, keterangan }) => {
  const existing = await absensiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data absensi tidak ditemukan", 404);
  }

  const effectiveJamMasuk = jamMasuk !== undefined ? jamMasuk : existing.jam_masuk;
  const effectiveJamKeluar = jamKeluar !== undefined ? jamKeluar : existing.jam_keluar;
  validateJamRange(effectiveJamMasuk, effectiveJamKeluar);

  const payload = {};
  if (tanggal !== undefined) {
    payload.tanggal = tanggal;
  }
  if (jamMasuk !== undefined) {
    payload.jam_masuk = jamMasuk;
  }
  if (jamKeluar !== undefined) {
    payload.jam_keluar = jamKeluar;
  }
  if (status !== undefined) {
    payload.status = status;
  }
  if (keterangan !== undefined) {
    payload.keterangan = keterangan;
  }

  try {
    const updated = await absensiRepository.update(id, payload);
    logger.info("Absensi updated", { absensiId: id, fields: Object.keys(payload) });
    return sanitizeAbsensi(updated);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("Absensi untuk pegawai dan tanggal tersebut sudah ada", 409);
    }
    if (err.code === "23514") {
      throw new AppError("jamKeluar harus lebih besar atau sama dengan jamMasuk", 422);
    }
    throw err;
  }
};

module.exports = { listAbsensi, getAbsensiById, createAbsensi, updateAbsensi };
