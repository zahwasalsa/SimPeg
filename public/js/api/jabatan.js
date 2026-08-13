import { apiFetch } from "./client.js";

export const listJabatan = ({ page = 1, limit = 10, search } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) {
    params.set("search", search);
  }
  return apiFetch(`/jabatan?${params.toString()}`);
};

export const getJabatan = (id) => apiFetch(`/jabatan/${id}`);

export const createJabatan = (payload) => apiFetch("/jabatan", { method: "POST", body: payload });

export const updateJabatan = (id, payload) => apiFetch(`/jabatan/${id}`, { method: "PATCH", body: payload });

export const deleteJabatan = (id) => apiFetch(`/jabatan/${id}`, { method: "DELETE" });
