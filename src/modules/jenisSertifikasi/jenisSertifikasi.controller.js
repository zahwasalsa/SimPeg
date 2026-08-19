const jenisSertifikasiService = require("./jenisSertifikasi.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { search } = req.query;

    const { jenisSertifikasi, pagination } = await jenisSertifikasiService.listJenisSertifikasi({
      page,
      limit,
      search,
    });

    responseHelper.paginated(res, {
      message: "Daftar jenis sertifikasi",
      data: jenisSertifikasi,
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
    const jenis = await jenisSertifikasiService.getJenisSertifikasiById(req.params.id);
    responseHelper.success(res, { message: "Detail jenis sertifikasi", data: jenis });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const jenis = await jenisSertifikasiService.createJenisSertifikasi(req.body);
    responseHelper.success(res, {
      statusCode: 201,
      message: "Jenis sertifikasi berhasil dibuat",
      data: jenis,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const jenis = await jenisSertifikasiService.updateJenisSertifikasi(req.params.id, req.body);
    responseHelper.success(res, { message: "Jenis sertifikasi berhasil diperbarui", data: jenis });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await jenisSertifikasiService.deleteJenisSertifikasi(req.params.id);
    responseHelper.success(res, { message: "Jenis sertifikasi berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update, remove };
