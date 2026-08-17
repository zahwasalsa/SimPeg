const kpiRepository = require("./kpi.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// FR-KPI-003/004: single source of truth for the KPI calculation business
// rules — kept here, not scattered across Controller/frontend, and not
// duplicated in more than one place in this file.
//
//   percentage (no kpi_detail)  = achievement / target * 100, 0 if target=0
//   detail percentage           = realization / target * 100, 0 if target=0
//   percentage (with details)   = Σ(detail percentage × weight) / Σ(weight)
//                                  when Σ(weight) > 0, else 0 (same
//                                  divide-by-zero-safe default as target=0 —
//                                  not a separate invented rule)
//
// Status thresholds are an explicit, disclosed business rule (blueprint does
// not define the numeric boundaries itself):
//   percentage === 0                        -> not_started
//   0 < percentage < AT_RISK_UPPER_BOUND     -> at_risk
//   AT_RISK_UPPER_BOUND <= percentage < 100  -> on_track
//   percentage >= 100                        -> achieved
const AT_RISK_UPPER_BOUND = 70;

const round2 = (n) => Math.round(n * 100) / 100;
const safeRatio = (numerator, denominator) =>
  Number(denominator) === 0 ? 0 : Number(numerator) / Number(denominator);

// Never clamped to 100 — achievement can legitimately exceed target (the
// real value must not be lost), only `calculateStatus` treats >=100 as a
// single terminal bucket.
const calculatePercentage = ({ target, achievement, details }) => {
  if (details.length > 0) {
    const totalWeight = details.reduce((sum, d) => sum + Number(d.weight), 0);
    if (totalWeight === 0) {
      return 0;
    }
    const weightedSum = details.reduce((sum, d) => {
      const detailPercentage = safeRatio(d.realization, d.target) * 100;
      return sum + detailPercentage * Number(d.weight);
    }, 0);
    return round2(weightedSum / totalWeight);
  }
  return round2(safeRatio(achievement, target) * 100);
};

const calculateStatus = (percentage) => {
  if (percentage === 0) {
    return "not_started";
  }
  if (percentage < AT_RISK_UPPER_BOUND) {
    return "at_risk";
  }
  if (percentage < 100) {
    return "on_track";
  }
  return "achieved";
};

const sanitizeKpi = (row) => ({
  id: row.id,
  pegawaiId: row.pegawai_id,
  period: row.period,
  target: Number(row.target),
  achievement: Number(row.achievement),
  percentage: Number(row.percentage),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeKpiDetail = (row) => ({
  id: row.id,
  kpiId: row.kpi_id,
  indicator: row.indicator,
  target: Number(row.target),
  realization: Number(row.realization),
  weight: Number(row.weight),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const resolveOwnPegawaiId = async (userId) => {
  const pegawaiId = await kpiRepository.findPegawaiIdByUserId(userId);
  if (!pegawaiId) {
    throw new AppError("Profil pegawai untuk akun Anda tidak ditemukan", 404);
  }
  return pegawaiId;
};

const isPrivileged = (role) => role === "admin" || role === "hrd";

// Recomputes and persists percentage/status from the current target/
// achievement/kpi_detail state — called after any write to achievement,
// target, or a kpi_detail row.
//
// When kpi_detail rows exist, `achievement` is re-derived from the
// detail-driven percentage (`achievement = percentage / 100 * target`) so it
// stays consistent with `target` — reading achievement/target directly
// always reproduces the same percentage, even though the real calculation
// came from the weighted indicators. Without kpi_detail, `achievement` is
// left untouched (it's the only source of truth for percentage in that case).
const recalculateKpi = async (kpiId) => {
  const kpi = await kpiRepository.findById(kpiId);
  if (!kpi) {
    return;
  }
  const details = await kpiRepository.findDetailsByKpiId(kpiId);
  const percentage = calculatePercentage({ target: kpi.target, achievement: kpi.achievement, details });
  const status = calculateStatus(percentage);

  const payload = { percentage, status };
  if (details.length > 0) {
    payload.achievement = round2((percentage / 100) * Number(kpi.target));
  }
  await kpiRepository.update(kpiId, payload);
};

const listKpi = async ({ page, limit, pegawaiId, period, status, requester }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    const ownPegawaiId = await kpiRepository.findPegawaiIdByUserId(requester.id);
    if (!ownPegawaiId) {
      return { kpi: [], pagination: { page, limit, total: 0 } };
    }
    scopedPegawaiId = ownPegawaiId;
  }

  const { data, total } = await kpiRepository.findAll({
    page,
    limit,
    pegawaiId: scopedPegawaiId,
    period,
    status,
  });

  return { kpi: data.map(sanitizeKpi), pagination: { page, limit, total } };
};

// `details` is embedded here (a second query) so callers get target,
// achievement, percentage, status, period, pegawai, AND the full indicator
// breakdown in one call — the list endpoint intentionally does NOT do this
// (would be N+1 across a page of rows), matching how dokumen/dokumen_version
// keep versions on a separate endpoint only for the list case.
const getKpiById = async (id) => {
  const kpi = await kpiRepository.findById(id);
  if (!kpi) {
    throw new AppError("Data KPI tidak ditemukan", 404);
  }
  const details = await kpiRepository.findDetailsByKpiId(id);
  return { ...sanitizeKpi(kpi), details: details.map(sanitizeKpiDetail) };
};

// FR-KPI-001: HRD/Admin set the target. Pegawai is never the creator here —
// matches the role design approved for this module (pegawai only inputs
// capaian on an existing record). `details` is optional — each entry seeds
// one kpi_detail row (indicator/target/weight); realization always starts 0
// and is never accepted here (that's FR-KPI-002, done afterward by pegawai).
const createKpi = async ({ pegawaiId, period, target, details }) => {
  const isPegawaiValid = await kpiRepository.pegawaiExists(pegawaiId);
  if (!isPegawaiValid) {
    throw new AppError("Pegawai tidak ditemukan", 404);
  }

  let created;
  try {
    created = await kpiRepository.create({
      pegawai_id: pegawaiId,
      period,
      target,
      achievement: 0,
      percentage: 0,
      status: "not_started",
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("KPI untuk pegawai dan periode ini sudah ada", 409);
    }
    throw err;
  }
  logger.info("KPI created", { kpiId: created.id, pegawaiId, period });

  let createdDetails = [];
  if (Array.isArray(details) && details.length > 0) {
    createdDetails = await kpiRepository.createDetailsBulk(
      details.map((d) => ({
        kpi_id: created.id,
        indicator: d.indicator,
        target: d.target,
        weight: d.weight === undefined ? 0 : d.weight,
      })),
    );
    await recalculateKpi(created.id);
    created = await kpiRepository.findById(created.id);
    logger.info("KPI details bulk-created", { kpiId: created.id, count: createdDetails.length });
  }

  return { ...sanitizeKpi(created), details: createdDetails.map(sanitizeKpiDetail) };
};

// FR-KPI-002: pegawai inputs achievement on their own record. Admin/HRD may
// additionally correct target/period. `status`/`percentage` are always
// server-computed — never accepted from the client.
const SELF_EDITABLE_FIELDS = ["achievement"];
const DETAIL_SELF_EDITABLE_FIELDS = ["realization"];

// `details` (optional) updates EXISTING kpi_detail rows only — each entry
// must carry its own `id` (adding a brand-new indicator still goes through
// POST /kpi/:id/detail). Same admin/hrd-vs-pegawai field split as the
// top-level KPI: pegawai may only touch `realization`, admin/hrd may touch
// indicator/target/weight too.
const applyDetailUpdates = async (kpiId, detailsInput, requester) => {
  for (const item of detailsInput) {
    if (!item.id) {
      throw new AppError("details[].id wajib diisi", 422);
    }
    const existingDetail = await kpiRepository.findDetailById(item.id);
    if (!existingDetail || existingDetail.kpi_id !== kpiId) {
      throw new AppError("Rincian KPI tidak ditemukan", 404);
    }

    if (!isPrivileged(requester.role)) {
      const disallowed = Object.keys(item).filter(
        (key) => key !== "id" && item[key] !== undefined && !DETAIL_SELF_EDITABLE_FIELDS.includes(key),
      );
      if (disallowed.length > 0) {
        throw new AppError(`Field berikut hanya dapat diubah oleh admin/HRD: ${disallowed.join(", ")}`, 403);
      }
    }

    const detailPayload = {};
    if (item.indicator !== undefined) detailPayload.indicator = item.indicator;
    if (item.target !== undefined) detailPayload.target = item.target;
    if (item.weight !== undefined) detailPayload.weight = item.weight;
    if (item.realization !== undefined) detailPayload.realization = item.realization;
    if (Object.keys(detailPayload).length > 0) {
      await kpiRepository.updateDetail(item.id, detailPayload);
    }
  }
};

const updateKpi = async (id, input, requester) => {
  if (!isPrivileged(requester.role)) {
    const disallowed = Object.keys(input).filter(
      (key) => input[key] !== undefined && key !== "details" && !SELF_EDITABLE_FIELDS.includes(key),
    );
    if (disallowed.length > 0) {
      throw new AppError(`Field berikut hanya dapat diubah oleh admin/HRD: ${disallowed.join(", ")}`, 403);
    }
  }

  const existing = await kpiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data KPI tidak ditemukan", 404);
  }

  const payload = {};
  if (input.period !== undefined) payload.period = input.period;
  if (input.target !== undefined) payload.target = input.target;
  if (input.achievement !== undefined) payload.achievement = input.achievement;

  if (Object.keys(payload).length > 0) {
    try {
      await kpiRepository.update(id, payload);
    } catch (err) {
      if (err.code === "23505") {
        throw new AppError("KPI untuk pegawai dan periode ini sudah ada", 409);
      }
      throw err;
    }
  }

  if (Array.isArray(input.details) && input.details.length > 0) {
    await applyDetailUpdates(id, input.details, requester);
  }

  await recalculateKpi(id);
  logger.info("KPI updated", { kpiId: id, fields: Object.keys(payload) });

  const updated = await kpiRepository.findById(id);
  const details = await kpiRepository.findDetailsByKpiId(id);
  return { ...sanitizeKpi(updated), details: details.map(sanitizeKpiDetail) };
};

const deleteKpi = async (id) => {
  const existing = await kpiRepository.findById(id);
  if (!existing) {
    throw new AppError("Data KPI tidak ditemukan", 404);
  }

  const deleted = await kpiRepository.softDelete(id);
  if (!deleted) {
    throw new AppError("Data KPI tidak ditemukan", 404);
  }
  logger.info("KPI deleted", { kpiId: id });
};

// --- kpi_detail ---

const listKpiDetail = async (kpiId) => {
  const details = await kpiRepository.findDetailsByKpiId(kpiId);
  return details.map(sanitizeKpiDetail);
};

const createKpiDetail = async (kpiId, { indicator, target, weight }) => {
  const kpi = await kpiRepository.findById(kpiId);
  if (!kpi) {
    throw new AppError("Data KPI tidak ditemukan", 404);
  }

  const created = await kpiRepository.createDetail({
    kpi_id: kpiId,
    indicator,
    target,
    weight: weight === undefined ? 0 : weight,
  });
  await recalculateKpi(kpiId);
  logger.info("KPI detail created", { kpiDetailId: created.id, kpiId });
  return sanitizeKpiDetail(created);
};

const updateKpiDetail = async (kpiId, detailId, input, requester) => {
  if (!isPrivileged(requester.role)) {
    const disallowed = Object.keys(input).filter(
      (key) => input[key] !== undefined && !DETAIL_SELF_EDITABLE_FIELDS.includes(key),
    );
    if (disallowed.length > 0) {
      throw new AppError(`Field berikut hanya dapat diubah oleh admin/HRD: ${disallowed.join(", ")}`, 403);
    }
  }

  const existing = await kpiRepository.findDetailById(detailId);
  if (!existing || existing.kpi_id !== kpiId) {
    throw new AppError("Rincian KPI tidak ditemukan", 404);
  }

  const payload = {};
  if (input.indicator !== undefined) payload.indicator = input.indicator;
  if (input.target !== undefined) payload.target = input.target;
  if (input.weight !== undefined) payload.weight = input.weight;
  if (input.realization !== undefined) payload.realization = input.realization;

  await kpiRepository.updateDetail(detailId, payload);
  await recalculateKpi(kpiId);
  logger.info("KPI detail updated", { kpiDetailId: detailId, kpiId, fields: Object.keys(payload) });
  return sanitizeKpiDetail(await kpiRepository.findDetailById(detailId));
};

const deleteKpiDetail = async (kpiId, detailId) => {
  const existing = await kpiRepository.findDetailById(detailId);
  if (!existing || existing.kpi_id !== kpiId) {
    throw new AppError("Rincian KPI tidak ditemukan", 404);
  }

  const deleted = await kpiRepository.softDeleteDetail(detailId);
  if (!deleted) {
    throw new AppError("Rincian KPI tidak ditemukan", 404);
  }
  await recalculateKpi(kpiId);
  logger.info("KPI detail deleted", { kpiDetailId: detailId, kpiId });
};

// FR-KPI-006: KPI Summary for the Dashboard. Pegawai always scoped to their
// own record; admin/hrd/pimpinan see the aggregate across all pegawai
// (optionally narrowed by pegawaiId/period) — matches the "Pimpinan
// memantau KPI dan laporan" / "HRD memantau KPI pegawai" role split.
const getKpiSummary = async ({ requester, pegawaiId, period }) => {
  let scopedPegawaiId = pegawaiId;

  if (requester.role === "pegawai") {
    scopedPegawaiId = await resolveOwnPegawaiId(requester.id);
  }

  const rows = await kpiRepository.findForSummary({ pegawaiId: scopedPegawaiId, period });

  const byStatus = { not_started: 0, on_track: 0, at_risk: 0, achieved: 0 };
  const byPeriod = {};
  let percentageSum = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    byPeriod[row.period] = (byPeriod[row.period] || 0) + 1;
    percentageSum += Number(row.percentage);
  }

  return {
    total: rows.length,
    byStatus,
    byPeriod,
    averagePercentage: rows.length > 0 ? round2(percentageSum / rows.length) : 0,
  };
};

module.exports = {
  listKpi,
  getKpiById,
  createKpi,
  updateKpi,
  deleteKpi,
  listKpiDetail,
  createKpiDetail,
  updateKpiDetail,
  deleteKpiDetail,
  getKpiSummary,
  resolveOwnPegawaiId,
};
