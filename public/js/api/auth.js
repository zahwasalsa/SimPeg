import { apiFetch } from "./client.js";
import { setSession, clearSession, getUser as getStoredUser } from "../auth/session.js";

export const login = async (email, password) => {
  const res = await apiFetch("/auth/login", { method: "POST", body: { email, password }, auth: false });
  setSession({
    accessToken: res.data.session.accessToken,
    refreshToken: res.data.session.refreshToken,
    user: res.data.user,
  });
  return res.data.user;
};

export const logout = async () => {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Ignore — we clear the local session regardless of whether the
    // server-side revoke call succeeded (e.g. token already expired).
  } finally {
    clearSession();
  }
};

export const fetchCurrentUser = async () => {
  const res = await apiFetch("/auth/me", { method: "GET" });
  setSession({ user: res.data });
  return res.data;
};

export const getCachedUser = () => getStoredUser();
