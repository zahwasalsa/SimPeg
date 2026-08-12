import { apiFetch } from "./client.js";

export const listKategoriDokumen = ({ page = 1, limit = 10, search } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) {
    params.set("search", search);
  }
  return apiFetch(`/kategori-dokumen?${params.toString()}`);
};

export const getKategoriDokumen = (id) => apiFetch(`/kategori-dokumen/${id}`);

export const createKategoriDokumen = (payload) =>
  apiFetch("/kategori-dokumen", { method: "POST", body: payload });

export const updateKategoriDokumen = (id, payload) =>
  apiFetch(`/kategori-dokumen/${id}`, { method: "PATCH", body: payload });
