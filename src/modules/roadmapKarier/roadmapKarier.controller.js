const roadmapKarierService = require("./roadmapKarier.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, status } = req.query;

    const { roadmapKarier, pagination } = await roadmapKarierService.listRoadmapKarier({
      page,
      limit,
      pegawaiId,
      status,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar roadmap karier",
      data: roadmapKarier,
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
    const roadmap = await roadmapKarierService.getRoadmapKarierById(req.params.id);
    responseHelper.success(res, { message: "Detail roadmap karier", data: roadmap });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, jabatanSaatIniId, jabatanTargetId, persyaratan, progress, status } = req.body;
    const roadmap = await roadmapKarierService.createRoadmapKarier({
      pegawaiId,
      jabatanSaatIniId,
      jabatanTargetId,
      persyaratan,
      progress,
      status,
    });
    responseHelper.success(res, {
      statusCode: 201,
      message: "Roadmap karier berhasil dibuat",
      data: roadmap,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const roadmap = await roadmapKarierService.updateRoadmapKarier(req.params.id, req.body);
    responseHelper.success(res, { message: "Roadmap karier berhasil diperbarui", data: roadmap });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await roadmapKarierService.deleteRoadmapKarier(req.params.id);
    responseHelper.success(res, { message: "Data roadmap karier berhasil dihapus", data: null });
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
