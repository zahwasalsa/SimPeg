import { apiFetch } from "./client.js";

export const listRoadmapKarier = ({ page = 1, limit = 10, pegawaiId, status } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (status) {
    params.set("status", status);
  }
  return apiFetch(`/roadmap-karier?${params.toString()}`);
};

export const getRoadmapKarier = (id) => apiFetch(`/roadmap-karier/${id}`);

// Admin/HRD only: menetapkan jabatan saat ini/target, persyaratan, dan
// progres/status awal.
export const createRoadmapKarier = (payload) =>
  apiFetch("/roadmap-karier", { method: "POST", body: payload });

// Admin/HRD only — pegawai tidak punya jalur tulis ke resource ini sama
// sekali (lihat roadmapKarier.service.js).
export const updateRoadmapKarier = (id, payload) =>
  apiFetch(`/roadmap-karier/${id}`, { method: "PATCH", body: payload });

export const deleteRoadmapKarier = (id) => apiFetch(`/roadmap-karier/${id}`, { method: "DELETE" });
