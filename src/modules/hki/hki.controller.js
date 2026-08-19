const hkiService = require("./hki.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, penelitianId } = req.query;

    const { hki, pagination } = await hkiService.listHki({
      page,
      limit,
      pegawaiId,
      penelitianId,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar HKI",
      data: hki,
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
    const hki = await hkiService.getHkiById(req.params.id);
    responseHelper.success(res, { message: "Detail HKI", data: hki });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, penelitianId, judul, jenis, nomorPendaftaran, tanggalPendaftaran } = req.body;
    const hki = await hkiService.createHki({
      requester: req.user,
      pegawaiId,
      penelitianId,
      judul,
      jenis,
      nomorPendaftaran,
      tanggalPendaftaran,
    });
    responseHelper.success(res, { statusCode: 201, message: "HKI berhasil dibuat", data: hki });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const hki = await hkiService.updateHki(req.params.id, req.body);
    responseHelper.success(res, { message: "HKI berhasil diperbarui", data: hki });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await hkiService.deleteHki(req.params.id);
    responseHelper.success(res, { message: "Data HKI berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
