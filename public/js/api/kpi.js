import { apiFetch } from "./client.js";

export const listKpi = ({ page = 1, limit = 10, pegawaiId, period, status } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (period) {
    params.set("period", period);
  }
  if (status) {
    params.set("status", status);
  }
  return apiFetch(`/kpi?${params.toString()}`);
};

export const getKpiSummary = ({ pegawaiId, period } = {}) => {
  const params = new URLSearchParams();
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (period) {
    params.set("period", period);
  }
  const qs = params.toString();
  return apiFetch(`/kpi/summary${qs ? `?${qs}` : ""}`);
};

export const getKpi = (id) => apiFetch(`/kpi/${id}`);

// HRD/Admin only: pegawaiId + period + target menetapkan KPI baru.
export const createKpi = (payload) => apiFetch("/kpi", { method: "POST", body: payload });

// Pegawai: hanya field `achievement`. Admin/HRD: boleh juga period/target.
export const updateKpi = (id, payload) => apiFetch(`/kpi/${id}`, { method: "PATCH", body: payload });

export const deleteKpi = (id) => apiFetch(`/kpi/${id}`, { method: "DELETE" });

export const listKpiDetail = (kpiId) => apiFetch(`/kpi/${kpiId}/detail`);

// HRD/Admin only: mendefinisikan indikator baru.
export const createKpiDetail = (kpiId, payload) =>
  apiFetch(`/kpi/${kpiId}/detail`, { method: "POST", body: payload });

// Pegawai: hanya field `realization`. Admin/HRD: boleh juga indicator/target/weight.
export const updateKpiDetail = (kpiId, detailId, payload) =>
  apiFetch(`/kpi/${kpiId}/detail/${detailId}`, { method: "PATCH", body: payload });

export const deleteKpiDetail = (kpiId, detailId) =>
  apiFetch(`/kpi/${kpiId}/detail/${detailId}`, { method: "DELETE" });
