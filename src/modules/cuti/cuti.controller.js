const cutiService = require("./cuti.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, status, jenisCuti } = req.query;

    const { cuti, pagination } = await cutiService.listCuti({
      page,
      limit,
      pegawaiId,
      status,
      jenisCuti,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar cuti",
      data: cuti,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
    });
  } catch (err) {
    next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const cuti = await cutiService.getCutiById(req.params.id);
    responseHelper.success(res, { message: "Detail cuti", data: cuti });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, jenisCuti, tanggalMulai, tanggalSelesai, alasan } = req.body;

    const cuti = await cutiService.createCuti({
      requester: req.user,
      pegawaiId,
      jenisCuti,
      tanggalMulai,
      tanggalSelesai,
      alasan,
    });

    responseHelper.success(res, { statusCode: 201, message: "Pengajuan cuti berhasil dibuat", data: cuti });
  } catch (err) {
    next(err);
  }
};

const approve = async (req, res, next) => {
  try {
    const cuti = await cutiService.approveCuti({
      id: req.params.id,
      approverId: req.user.id,
      catatanApproval: req.body.catatanApproval,
    });
    responseHelper.success(res, { message: "Cuti disetujui", data: cuti });
  } catch (err) {
    next(err);
  }
};

const reject = async (req, res, next) => {
  try {
    const cuti = await cutiService.rejectCuti({
      id: req.params.id,
      approverId: req.user.id,
      catatanApproval: req.body.catatanApproval,
    });
    responseHelper.success(res, { message: "Cuti ditolak", data: cuti });
  } catch (err) {
    next(err);
  }
};

const cancel = async (req, res, next) => {
  try {
    const cuti = await cutiService.cancelCuti(req.params.id);
    responseHelper.success(res, { message: "Cuti dibatalkan", data: cuti });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, approve, reject, cancel };
