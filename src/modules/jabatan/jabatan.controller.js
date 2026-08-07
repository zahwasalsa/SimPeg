const jabatanService = require("./jabatan.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { search } = req.query;

    const { jabatan, pagination } = await jabatanService.listJabatan({ page, limit, search });

    responseHelper.paginated(res, {
      message: "Daftar jabatan",
      data: jabatan,
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
    const jabatan = await jabatanService.getJabatanById(req.params.id);
    responseHelper.success(res, { message: "Detail jabatan", data: jabatan });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const jabatan = await jabatanService.createJabatan(req.body);
    responseHelper.success(res, { statusCode: 201, message: "Jabatan berhasil dibuat", data: jabatan });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const jabatan = await jabatanService.updateJabatan(req.params.id, req.body);
    responseHelper.success(res, { message: "Jabatan berhasil diperbarui", data: jabatan });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update };
