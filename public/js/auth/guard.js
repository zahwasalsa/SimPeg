import { isAuthenticated, clearSession } from "./session.js";
import { fetchCurrentUser } from "../api/auth.js";

// UI-level guard only — this exists to redirect the browser to a sensible
// page and hide/show UI. The real authorization decision always happens on
// the backend (authMiddleware/authorize) on every API call regardless of
// what this function decides.
export const requireAuth = async () => {
  if (!isAuthenticated()) {
    window.location.href = "/login";
    return null;
  }

  try {
    return await fetchCurrentUser();
  } catch {
    clearSession();
    window.location.href = "/login";
    return null;
  }
};

export const requireRole = (user, allowedRoles) => {
  if (!user || !allowedRoles.includes(user.role)) {
    window.location.href = "/dashboard";
    return false;
  }
  return true;
};

export const redirectIfAuthenticated = () => {
  if (isAuthenticated()) {
    window.location.href = "/dashboard";
  }
};
