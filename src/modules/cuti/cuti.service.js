const cutiRepository = require("./cuti.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

const sanitizeCuti = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  jenisCuti: row.jenis_cuti,
  tanggalMulai: row.tanggal_mulai,
  tanggalSelesai: row.tanggal_selesai,
  jumlahHari: row.jumlah_hari,
  alasan: row.alasan,
  status: row.status,
  disetujuiOleh: row.disetujui_oleh,
  tanggalPersetujuan: row.tanggal_persetujuan,
  catatanApproval: row.catatan_approval,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await cutiRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const todayDateString = () => new Date().toISOString().slice(0, 10);

const validateTanggal = (tanggalMulai, tanggalSelesai) => {
  if (tanggalSelesai < tanggalMulai) {
    throw new AppError("tanggalSelesai harus lebih besar atau sama dengan tanggalMulai", 422);
  }
};

const validateBackdated = ({ role, tanggalMulai, jenisCuti }) => {
  if (role === "admin" || role === "hrd") {
    return;
  }
  if (jenisCuti === "cuti_sakit") {
    return;
  }
  if (tanggalMulai < todayDateString()) {
    throw new AppError("tanggalMulai tidak boleh sebelum hari ini, kecuali untuk jenisCuti cuti_sakit", 422);
  }
};

const checkOverlap = async (pegawaiId, tanggalMulai, tanggalSelesai) => {
  const overlapping = await cutiRepository.findOverlapping(pegawaiId, tanggalMulai, tanggalSelesai);
  if (overlapping.length > 0) {
    throw new AppError("Tanggal cuti bentrok dengan pengajuan lain yang masih aktif", 409);
  }
};

const ensurePending = (cuti) => {
  if (cuti.status !== "diajukan") {
    throw new AppError(`Pengajuan cuti sudah diproses (status saat ini: ${cuti.status})`, 409);
  }
};

const listCuti = async ({ page, limit, pegawaiId, status, jenisCuti, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role !== "admin" && requester.role !== "hrd") {
    const ownPegawaiId = await cutiRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { cuti: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await cutiRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    status,
    jenisCuti,
  });

  return { cuti: data.map(sanitizeCuti), pagination: { page, limit, total } };
};

const getCutiById = async (id) => {
  const cuti = await cutiRepository.findById(id);
  if (!cuti) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }
  return sanitizeCuti(cuti);
};

const createCuti = async ({ requester, pegawaiId, jenisCuti, tanggalMulai, tanggalSelesai, alasan }) => {
  let targetPegawaiId;

  if (requester.role === "admin" || requester.role === "hrd") {
    const isPegawaiValid = await cutiRepository.pegawaiExists(pegawaiId);
    if (!isPegawaiValid) {
      throw new AppError("Pegawai tidak ditemukan", 404);
    }
    targetPegawaiId = pegawaiId;
  } else {
    targetPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  validateTanggal(tanggalMulai, tanggalSelesai);
  validateBackdated({ role: requester.role, tanggalMulai, jenisCuti });
  await checkOverlap(targetPegawaiId, tanggalMulai, tanggalSelesai);

  try {
    const created = await cutiRepository.create({
      pegawai_id: targetPegawaiId,
      jenis_cuti: jenisCuti,
      tanggal_mulai: tanggalMulai,
      tanggal_selesai: tanggalSelesai,
      alasan: alasan || null,
      status: "diajukan",
    });
    logger.info("Cuti created", { cutiId: created.id, pegawaiId: targetPegawaiId, actorId: requester.id });
    return sanitizeCuti(created);
  } catch (err) {
    if (err.code === "23514") {
      throw new AppError("tanggalSelesai harus lebih besar atau sama dengan tanggalMulai", 422);
    }
    throw err;
  }
};

const approveCuti = async ({ id, approverId, catatanApproval }) => {
  const existing = await cutiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }
  ensurePending(existing);

  const updated = await cutiRepository.update(id, {
    status: "disetujui",
    disetujui_oleh: approverId,
    tanggal_persetujuan: new Date().toISOString(),
    catatan_approval: catatanApproval || null,
  });
  logger.info("Cuti approved", { cutiId: id, approverId });
  return sanitizeCuti(updated);
};

const rejectCuti = async ({ id, approverId, catatanApproval }) => {
  const existing = await cutiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }
  ensurePending(existing);

  const updated = await cutiRepository.update(id, {
    status: "ditolak",
    disetujui_oleh: approverId,
    tanggal_persetujuan: new Date().toISOString(),
    catatan_approval: catatanApproval,
  });
  logger.info("Cuti rejected", { cutiId: id, approverId });
  return sanitizeCuti(updated);
};

const cancelCuti = async (id) => {
  const existing = await cutiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }
  ensurePending(existing);

  const updated = await cutiRepository.update(id, { status: "dibatalkan" });
  logger.info("Cuti cancelled", { cutiId: id });
  return sanitizeCuti(updated);
};

const deleteCuti = async (id) => {
  const existing = await cutiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }

  const deleted = await cutiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data cuti tidak ditemukan", 404);
  }
  logger.info("Cuti deleted", { cutiId: id });
};

module.exports = { listCuti, getCutiById, createCuti, approveCuti, rejectCuti, cancelCuti, deleteCuti };
