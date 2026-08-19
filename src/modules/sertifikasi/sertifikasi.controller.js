const sertifikasiService = require("./sertifikasi.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, jenisSertifikasiId, akanBerakhir, kedaluwarsa } = req.query;

    const { sertifikasi, pagination } = await sertifikasiService.listSertifikasi({
      page,
      limit,
      pegawaiId,
      jenisSertifikasiId,
      akanBerakhir,
      kedaluwarsa,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar sertifikasi",
      data: sertifikasi,
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
    const sertifikasi = await sertifikasiService.getSertifikasiById(req.params.id);
    responseHelper.success(res, { message: "Detail sertifikasi", data: sertifikasi });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      pegawaiId,
      jenisSertifikasiId,
      namaSertifikat,
      penerbit,
      nomorSertifikat,
      tanggalTerbit,
      tanggalBerakhir,
    } = req.body;

    const sertifikasi = await sertifikasiService.createSertifikasi({
      requester: req.user,
      pegawaiId,
      jenisSertifikasiId,
      namaSertifikat,
      penerbit,
      nomorSertifikat,
      tanggalTerbit,
      tanggalBerakhir,
      file: req.file,
    });

    responseHelper.success(res, {
      statusCode: 201,
      message: "Sertifikasi berhasil dibuat",
      data: sertifikasi,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const sertifikasi = await sertifikasiService.updateSertifikasi(req.params.id, req.body);
    responseHelper.success(res, { message: "Sertifikasi berhasil diperbarui", data: sertifikasi });
  } catch (err) {
    next(err);
  }
};

// Mirrors dokumen.controller.js#download: ?download=1 returns a signed URL
// with Content-Disposition: attachment, omitting it returns an
// inline-viewable signed URL.
const download = async (req, res, next) => {
  try {
    const { url, expiresIn } = await sertifikasiService.getSertifikasiDownloadUrl(req.params.id, {
      download: req.query.download === "1" || req.query.download === "true",
    });
    responseHelper.success(res, { message: "Tautan berkas sertifikasi", data: { url, expiresIn } });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await sertifikasiService.deleteSertifikasi(req.params.id);
    responseHelper.success(res, { message: "Data sertifikasi berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, create, update, download, remove };
