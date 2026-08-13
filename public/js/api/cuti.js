import { apiFetch } from "./client.js";

export const listCuti = ({ page = 1, limit = 10, pegawaiId, status, jenisCuti } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (status) {
    params.set("status", status);
  }
  if (jenisCuti) {
    params.set("jenisCuti", jenisCuti);
  }
  return apiFetch(`/cuti?${params.toString()}`);
};

export const getCuti = (id) => apiFetch(`/cuti/${id}`);

// pegawaiId is required in payload for admin/hrd submitting on someone
// else's behalf, and must be omitted entirely when a pegawai submits for
// themselves (identity is derived server-side from the JWT either way).
export const createCuti = (payload) => apiFetch("/cuti", { method: "POST", body: payload });

export const approveCuti = (id, payload = {}) =>
  apiFetch(`/cuti/${id}/approve`, { method: "PATCH", body: payload });

export const rejectCuti = (id, payload) => apiFetch(`/cuti/${id}/reject`, { method: "PATCH", body: payload });

export const cancelCuti = (id) => apiFetch(`/cuti/${id}/cancel`, { method: "PATCH", body: {} });

export const deleteCuti = (id) => apiFetch(`/cuti/${id}`, { method: "DELETE" });
