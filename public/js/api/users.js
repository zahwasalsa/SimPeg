import { apiFetch } from "./client.js";

export const listUsers = ({ page = 1, limit = 10 } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/users?${params.toString()}`);
};

export const getUser = (id) => apiFetch(`/users/${id}`);

export const createUser = (payload) => apiFetch("/users", { method: "POST", body: payload });

export const updateUserEmail = (id, payload) =>
  apiFetch(`/users/${id}/email`, { method: "PATCH", body: payload });

export const updateUserPassword = (id, payload) =>
  apiFetch(`/users/${id}/password`, { method: "PATCH", body: payload });

export const updateUserRole = (id, payload) =>
  apiFetch(`/users/${id}/role`, { method: "PATCH", body: payload });

export const updateUserStatus = (id, payload) =>
  apiFetch(`/users/${id}/status`, { method: "PATCH", body: payload });

export const deleteUser = (id) => apiFetch(`/users/${id}`, { method: "DELETE" });
