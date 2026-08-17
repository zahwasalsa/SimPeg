const kpiService = require("./kpi.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { pegawaiId, period, status } = req.query;

    const { kpi, pagination } = await kpiService.listKpi({
      page,
      limit,
      pegawaiId,
      period,
      status,
      requester: req.user,
    });

    responseHelper.paginated(res, {
      message: "Daftar KPI",
      data: kpi,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
    });
  } catch (err) {
    next(err);
  }
};

const summary = async (req, res, next) => {
  try {
    const { pegawaiId, period } = req.query;
    const result = await kpiService.getKpiSummary({ requester: req.user, pegawaiId, period });
    responseHelper.success(res, { message: "Ringkasan KPI", data: result });
  } catch (err) {
    next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const kpi = await kpiService.getKpiById(req.params.id);
    responseHelper.success(res, { message: "Detail KPI", data: kpi });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { pegawaiId, period, target, details } = req.body;
    const kpi = await kpiService.createKpi({ pegawaiId, period, target, details });
    responseHelper.success(res, { statusCode: 201, message: "KPI berhasil dibuat", data: kpi });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const kpi = await kpiService.updateKpi(req.params.id, req.body, req.user);
    responseHelper.success(res, { message: "KPI berhasil diperbarui", data: kpi });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await kpiService.deleteKpi(req.params.id);
    responseHelper.success(res, { message: "Data KPI berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

const listDetail = async (req, res, next) => {
  try {
    const details = await kpiService.listKpiDetail(req.params.id);
    responseHelper.success(res, { message: "Daftar rincian KPI", data: details });
  } catch (err) {
    next(err);
  }
};

const createDetail = async (req, res, next) => {
  try {
    const { indicator, target, weight } = req.body;
    const created = await kpiService.createKpiDetail(req.params.id, { indicator, target, weight });
    responseHelper.success(res, { statusCode: 201, message: "Rincian KPI berhasil dibuat", data: created });
  } catch (err) {
    next(err);
  }
};

const updateDetail = async (req, res, next) => {
  try {
    const updated = await kpiService.updateKpiDetail(req.params.id, req.params.detailId, req.body, req.user);
    responseHelper.success(res, { message: "Rincian KPI berhasil diperbarui", data: updated });
  } catch (err) {
    next(err);
  }
};

const removeDetail = async (req, res, next) => {
  try {
    await kpiService.deleteKpiDetail(req.params.id, req.params.detailId);
    responseHelper.success(res, { message: "Rincian KPI berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  summary,
  detail,
  create,
  update,
  remove,
  listDetail,
  createDetail,
  updateDetail,
  removeDetail,
};
