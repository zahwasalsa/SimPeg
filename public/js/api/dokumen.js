import { apiFetch } from "./client.js";

export const listDokumen = ({ page = 1, limit = 10, pegawaiId, kategoriDokumenId } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (kategoriDokumenId) {
    params.set("kategoriDokumenId", kategoriDokumenId);
  }
  return apiFetch(`/dokumen?${params.toString()}`);
};

export const getDokumen = (id) => apiFetch(`/dokumen/${id}`);

// `payload` is a FormData instance (pegawaiId?, kategoriDokumenId, namaDokumen, file).
export const createDokumen = (payload) => apiFetch("/dokumen", { method: "POST", body: payload });

// Returns a short-lived signed URL. `download: true` sets
// Content-Disposition: attachment server-side; omitting it yields an
// inline-viewable URL for preview.
export const getDokumenUrl = (id, { download } = {}) => {
  const params = download ? "?download=1" : "";
  return apiFetch(`/dokumen/${id}/download${params}`);
};

// Version history — Stage 4B (FR-DOC-004/005).
export const listDokumenVersi = (dokumenId, { page = 1, limit = 100 } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/dokumen/${dokumenId}/versi?${params.toString()}`);
};

// `payload` is a FormData instance containing only `file` — the version
// always belongs to the same pegawai/kategori as the parent document.
export const createDokumenVersi = (dokumenId, payload) =>
  apiFetch(`/dokumen/${dokumenId}/versi`, { method: "POST", body: payload });

export const getDokumenVersiUrl = (dokumenId, versionId, { download } = {}) => {
  const params = download ? "?download=1" : "";
  return apiFetch(`/dokumen/${dokumenId}/versi/${versionId}/download${params}`);
};

export const deleteDokumen = (id) => apiFetch(`/dokumen/${id}`, { method: "DELETE" });
