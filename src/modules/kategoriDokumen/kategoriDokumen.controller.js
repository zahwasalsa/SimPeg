const kategoriDokumenService = require("./kategoriDokumen.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { search } = req.query;

    const { kategoriDokumen, pagination } = await kategoriDokumenService.listKategoriDokumen({
      page,
      limit,
      search,
    });

    responseHelper.paginated(res, {
      message: "Daftar kategori dokumen",
      data: kategoriDokumen,
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
    const kategori = await kategoriDokumenService.getKategoriDokumenById(req.params.id);
    responseHelper.success(res, { message: "Detail kategori dokumen", data: kategori });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const kategori = await kategoriDokumenService.createKategoriDokumen(req.body);
    responseHelper.success(res, {
      statusCode: 201,
      message: "Kategori dokumen berhasil dibuat",
      data: kategori,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const kategori = await kategoriDokumenService.updateKategoriDokumen(req.params.id, req.body);
    responseHelper.success(res, { message: "Kategori dokumen berhasil diperbarui", data: kategori });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update };
