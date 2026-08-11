import { getAccessToken, getRefreshToken, setSession, clearSession } from "../auth/session.js";

const BASE_URL = window.APP_CONFIG.apiBaseUrl;

let refreshPromise = null;

const doRefresh = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Tidak ada refresh token");
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body || !body.success) {
    throw new Error((body && body.message) || "Gagal memperbarui sesi");
  }

  setSession({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
  return body.data.accessToken;
};

// Thin fetch wrapper: attaches the bearer token, retries once via
// /auth/refresh on a 401, and normalizes error responses into thrown Errors
// so pages don't need to repeat try/catch boilerplate for every call.
export const apiFetch = async (path, { method = "GET", body, auth = true, retry = true } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);

  if (res.status === 401 && auth && retry) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return apiFetch(path, { method, body, auth, retry: false });
    } catch {
      clearSession();
      window.location.href = "/login";
      throw new Error("Sesi berakhir, silakan login kembali");
    }
  }

  if (!res.ok || (payload && payload.success === false)) {
    const message = (payload && payload.message) || `Permintaan gagal (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.errors = payload && payload.errors;
    throw error;
  }

  return payload;
};
