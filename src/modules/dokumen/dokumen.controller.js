const dokumenService = require("./dokumen.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, kategoriDokumenId } = req.query;

    const { dokumen, pagination } = await dokumenService.listDokumen({
      page,
      limit,
      pegawaiId,
      kategoriDokumenId,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar dokumen",
      data: dokumen,
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
    const dokumen = await dokumenService.getDokumenById(req.params.id);
    responseHelper.success(res, { message: "Detail dokumen", data: dokumen });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, kategoriDokumenId, namaDokumen } = req.body;

    const dokumen = await dokumenService.createDokumen({
      requester: req.user,
      pegawaiId,
      kategoriDokumenId,
      namaDokumen,
      file: req.file,
    });

    responseHelper.success(res, { statusCode: 201, message: "Dokumen berhasil diunggah", data: dokumen });
  } catch (err) {
    next(err);
  }
};

// One endpoint serves both FR-DOC-002 (preview) and FR-DOC-003 (download):
// ?download=1 returns a signed URL with Content-Disposition: attachment,
// omitting it returns an inline-viewable signed URL.
const download = async (req, res, next) => {
  try {
    const { url, expiresIn } = await dokumenService.getDokumenDownloadUrl(req.params.id, {
      download: req.query.download === "1" || req.query.download === "true",
    });
    responseHelper.success(res, { message: "Tautan dokumen", data: { url, expiresIn } });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, download };
