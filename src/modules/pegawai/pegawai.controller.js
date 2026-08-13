const pegawaiService = require("./pegawai.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { search, divisiId, jabatanId, status } = req.query;

    const { pegawai, pagination } = await pegawaiService.listPegawai({
      page,
      limit,
      search,
      divisiId,
      jabatanId,
      status,
    });

    responseHelper.paginated(res, {
      message: "Daftar pegawai",
      data: pegawai,
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
    const pegawai = await pegawaiService.getPegawaiById(req.params.id);
    responseHelper.success(res, { message: "Detail pegawai", data: pegawai });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const pegawai = await pegawaiService.createPegawai(req.body);
    responseHelper.success(res, { statusCode: 201, message: "Pegawai berhasil dibuat", data: pegawai });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const pegawai = await pegawaiService.updatePegawai(req.params.id, req.body, req.user);
    responseHelper.success(res, { message: "Pegawai berhasil diperbarui", data: pegawai });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await pegawaiService.deletePegawai(req.params.id);
    responseHelper.success(res, { message: "Pegawai berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update, remove };
