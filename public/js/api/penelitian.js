import { apiFetch } from "./client.js";

export const listPenelitian = ({ page = 1, limit = 10, pegawaiId, tahun } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (tahun) {
    params.set("tahun", String(tahun));
  }
  return apiFetch(`/penelitian?${params.toString()}`);
};

export const getPenelitian = (id) => apiFetch(`/penelitian/${id}`);

// Admin/HRD: pegawaiId wajib. Pegawai: pegawaiId tidak boleh dikirim (backend
// menolak 422) — pemilik selalu otomatis diri sendiri.
export const createPenelitian = (payload) => apiFetch("/penelitian", { method: "POST", body: payload });

// pegawaiId tidak pernah dikirim di sini — tidak bisa diubah setelah dibuat.
export const updatePenelitian = (id, payload) =>
  apiFetch(`/penelitian/${id}`, { method: "PATCH", body: payload });

export const deletePenelitian = (id) => apiFetch(`/penelitian/${id}`, { method: "DELETE" });

export const listAnggotaPenelitian = (penelitianId) => apiFetch(`/penelitian/${penelitianId}/anggota`);

export const createAnggotaPenelitian = (penelitianId, payload) =>
  apiFetch(`/penelitian/${penelitianId}/anggota`, { method: "POST", body: payload });

export const deleteAnggotaPenelitian = (penelitianId, anggotaId) =>
  apiFetch(`/penelitian/${penelitianId}/anggota/${anggotaId}`, { method: "DELETE" });

export const listPublikasi = (penelitianId) => apiFetch(`/penelitian/${penelitianId}/publikasi`);

export const createPublikasi = (penelitianId, payload) =>
  apiFetch(`/penelitian/${penelitianId}/publikasi`, { method: "POST", body: payload });

export const updatePublikasi = (penelitianId, publikasiId, payload) =>
  apiFetch(`/penelitian/${penelitianId}/publikasi/${publikasiId}`, { method: "PATCH", body: payload });

export const deletePublikasi = (penelitianId, publikasiId) =>
  apiFetch(`/penelitian/${penelitianId}/publikasi/${publikasiId}`, { method: "DELETE" });
