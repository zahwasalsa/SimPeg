const absensiService = require("./absensi.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, tanggal, status } = req.query;

    const { absensi, pagination } = await absensiService.listAbsensi({
      page,
      limit,
      pegawaiId,
      tanggal,
      status,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar absensi",
      data: absensi,
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
    const absensi = await absensiService.getAbsensiById(req.params.id);
    responseHelper.success(res, { message: "Detail absensi", data: absensi });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, tanggal, jamMasuk, jamKeluar, status, keterangan } = req.body;

    const result = await absensiService.createAbsensi({
      requester: req.user,
      pegawaiId,
      tanggal,
      jamMasuk,
      jamKeluar,
      status,
      keterangan,
    });

    const message =
      result.statusCode === 201 ? "Absensi berhasil dicatat (check-in)" : "Check-out berhasil dicatat";

    responseHelper.success(res, { statusCode: result.statusCode, message, data: result.data });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const absensi = await absensiService.updateAbsensi(req.params.id, req.body);
    responseHelper.success(res, { message: "Absensi berhasil diperbarui", data: absensi });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await absensiService.deleteAbsensi(req.params.id);
    responseHelper.success(res, { message: "Absensi berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update, remove };
