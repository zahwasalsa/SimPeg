const penelitianService = require("./penelitian.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, tahun } = req.query;

    const { penelitian, pagination } = await penelitianService.listPenelitian({
      page,
      limit,
      pegawaiId,
      tahun,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar penelitian",
      data: penelitian,
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
    const penelitian = await penelitianService.getPenelitianById(req.params.id);
    responseHelper.success(res, { message: "Detail penelitian", data: penelitian });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, judul, skema, dana, tahun } = req.body;
    const penelitian = await penelitianService.createPenelitian({
      requester: req.user,
      pegawaiId,
      judul,
      skema,
      dana,
      tahun,
    });
    responseHelper.success(res, { statusCode: 201, message: "Penelitian berhasil dibuat", data: penelitian });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const penelitian = await penelitianService.updatePenelitian(req.params.id, req.body);
    responseHelper.success(res, { message: "Penelitian berhasil diperbarui", data: penelitian });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await penelitianService.deletePenelitian(req.params.id);
    responseHelper.success(res, { message: "Data penelitian berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

const listAnggota = async (req, res, next) => {
  try {
    const anggota = await penelitianService.listAnggota(req.params.id);
    responseHelper.success(res, { message: "Daftar anggota penelitian", data: anggota });
  } catch (err) {
    next(err);
  }
};

const createAnggota = async (req, res, next) => {
  try {
    const created = await penelitianService.createAnggota(req.params.id, { pegawaiId: req.body.pegawaiId });
    responseHelper.success(res, {
      statusCode: 201,
      message: "Anggota penelitian berhasil ditambahkan",
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

const removeAnggota = async (req, res, next) => {
  try {
    await penelitianService.deleteAnggota(req.params.id, req.params.anggotaId);
    responseHelper.success(res, { message: "Anggota penelitian berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

const listPublikasi = async (req, res, next) => {
  try {
    const publikasi = await penelitianService.listPublikasi(req.params.id);
    responseHelper.success(res, { message: "Daftar publikasi", data: publikasi });
  } catch (err) {
    next(err);
  }
};

const createPublikasi = async (req, res, next) => {
  try {
    const { judul, jurnal, terindeks, tahun } = req.body;
    const created = await penelitianService.createPublikasi(req.params.id, {
      judul,
      jurnal,
      terindeks,
      tahun,
    });
    responseHelper.success(res, { statusCode: 201, message: "Publikasi berhasil dibuat", data: created });
  } catch (err) {
    next(err);
  }
};

const updatePublikasi = async (req, res, next) => {
  try {
    const updated = await penelitianService.updatePublikasi(req.params.id, req.params.publikasiId, req.body);
    responseHelper.success(res, { message: "Publikasi berhasil diperbarui", data: updated });
  } catch (err) {
    next(err);
  }
};

const removePublikasi = async (req, res, next) => {
  try {
    await penelitianService.deletePublikasi(req.params.id, req.params.publikasiId);
    responseHelper.success(res, { message: "Publikasi berhasil dihapus", data: null });
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
  listAnggota,
  createAnggota,
  removeAnggota,
  listPublikasi,
  createPublikasi,
  updatePublikasi,
  removePublikasi,
};
