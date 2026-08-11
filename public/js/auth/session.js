// Client-side session cache. Never stores anything beyond what the backend
// already returns to an authenticated user (their own access/refresh token
// and their own profile) — no secrets, no service role key, ever.
const STORAGE_KEY = "simpeg.session";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const write = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const setSession = ({ accessToken, refreshToken, user }) => {
  const current = read();
  write({
    accessToken: accessToken !== undefined ? accessToken : current.accessToken,
    refreshToken: refreshToken !== undefined ? refreshToken : current.refreshToken,
    user: user !== undefined ? user : current.user,
  });
};

export const getAccessToken = () => read().accessToken || null;
export const getRefreshToken = () => read().refreshToken || null;
export const getUser = () => read().user || null;
export const isAuthenticated = () => Boolean(getAccessToken());

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};
