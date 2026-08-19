import { apiFetch } from "./client.js";

export const listHki = ({ page = 1, limit = 10, pegawaiId, penelitianId } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (pegawaiId) {
    params.set("pegawaiId", pegawaiId);
  }
  if (penelitianId) {
    params.set("penelitianId", penelitianId);
  }
  return apiFetch(`/hki?${params.toString()}`);
};

export const getHki = (id) => apiFetch(`/hki/${id}`);

// Admin/HRD: pegawaiId wajib. Pegawai: pegawaiId tidak boleh dikirim (backend
// menolak 422) — pemilik selalu otomatis diri sendiri.
export const createHki = (payload) => apiFetch("/hki", { method: "POST", body: payload });

// pegawaiId tidak pernah dikirim di sini — tidak bisa diubah setelah dibuat.
export const updateHki = (id, payload) => apiFetch(`/hki/${id}`, { method: "PATCH", body: payload });

export const deleteHki = (id) => apiFetch(`/hki/${id}`, { method: "DELETE" });
