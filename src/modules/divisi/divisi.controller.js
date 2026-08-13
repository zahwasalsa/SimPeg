const divisiService = require("./divisi.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { search } = req.query;

    const { divisi, pagination } = await divisiService.listDivisi({ page, limit, search });

    responseHelper.paginated(res, {
      message: "Daftar divisi",
      data: divisi,
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
    const divisi = await divisiService.getDivisiById(req.params.id);
    responseHelper.success(res, { message: "Detail divisi", data: divisi });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const divisi = await divisiService.createDivisi(req.body);
    responseHelper.success(res, { statusCode: 201, message: "Divisi berhasil dibuat", data: divisi });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const divisi = await divisiService.updateDivisi(req.params.id, req.body);
    responseHelper.success(res, { message: "Divisi berhasil diperbarui", data: divisi });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await divisiService.deleteDivisi(req.params.id);
    responseHelper.success(res, { message: "Divisi berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update, remove };
