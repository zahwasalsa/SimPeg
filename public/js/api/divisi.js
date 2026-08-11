import { apiFetch } from "./client.js";

export const listDivisi = ({ page = 1, limit = 10, search } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) {
    params.set("search", search);
  }
  return apiFetch(`/divisi?${params.toString()}`);
};

export const getDivisi = (id) => apiFetch(`/divisi/${id}`);

export const createDivisi = (payload) => apiFetch("/divisi", { method: "POST", body: payload });

export const updateDivisi = (id, payload) => apiFetch(`/divisi/${id}`, { method: "PATCH", body: payload });
