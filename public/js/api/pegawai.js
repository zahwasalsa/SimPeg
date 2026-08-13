import { apiFetch } from "./client.js";

export const listPegawai = ({ page = 1, limit = 10, search, divisiId, jabatanId, status } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) {
    params.set("search", search);
  }
  if (divisiId) {
    params.set("divisiId", divisiId);
  }
  if (jabatanId) {
    params.set("jabatanId", jabatanId);
  }
  if (status) {
    params.set("status", status);
  }
  return apiFetch(`/pegawai?${params.toString()}`);
};

export const getPegawai = (id) => apiFetch(`/pegawai/${id}`);

export const createPegawai = (payload) => apiFetch("/pegawai", { method: "POST", body: payload });

export const updatePegawai = (id, payload) => apiFetch(`/pegawai/${id}`, { method: "PATCH", body: payload });

export const deletePegawai = (id) => apiFetch(`/pegawai/${id}`, { method: "DELETE" });
