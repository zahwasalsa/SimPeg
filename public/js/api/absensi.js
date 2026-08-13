import { apiFetch } from "./client.js";

export const listAbsensi = ({ page = 1, limit = 10, pegawaiId, tanggal, status } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (tanggal) {
    params.set("tanggal", tanggal);
  }
  if (status) {
    params.set("status", status);
  }
  return apiFetch(`/absensi?${params.toString()}`);
};

export const getAbsensi = (id) => apiFetch(`/absensi/${id}`);

// POST is overloaded server-side: admin/hrd strictly create (pegawaiId
// required in body); pegawai omits pegawaiId and the backend derives
// check-in vs check-out from whether today's row already exists.
export const createAbsensi = (payload) => apiFetch("/absensi", { method: "POST", body: payload });

export const updateAbsensi = (id, payload) => apiFetch(`/absensi/${id}`, { method: "PATCH", body: payload });

export const deleteAbsensi = (id) => apiFetch(`/absensi/${id}`, { method: "DELETE" });
