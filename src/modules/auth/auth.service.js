const supabaseAdmin = require("../../config/supabase");
const supabaseAuthClient = require("../../config/supabaseAuthClient");
const environment = require("../../config/environment");
const logger = require("../../shared/logger/logger");
const AppError = require("../../shared/exceptions/appError");
const authRepository = require("./auth.repository");

const sanitizeUser = (profile) => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  isActive: profile.is_active,
  lastLogin: profile.last_login,
  createdAt: profile.created_at,
});

const sanitizeSession = (session) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at,
  expiresIn: session.expires_in,
  tokenType: session.token_type,
});

const register = async ({ email, password }) => {
  // Role is intentionally never accepted from the client here — every
  // self-registered account starts as 'pegawai'. Elevating to hrd/admin/
  // pimpinan is an administrative action outside this endpoint's scope.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "pegawai" },
  });

  if (error) {
    if (error.status === 422 || /already been registered|already exists/i.test(error.message)) {
      throw new AppError("Email sudah terdaftar", 409);
    }
    logger.error("Supabase admin.createUser failed", { message: error.message });
    throw new AppError("Registrasi gagal", 400);
  }

  const profile = await authRepository.findById(data.user.id);
  if (!profile) {
    logger.error("public.users row missing after registration", { userId: data.user.id });
    throw new AppError("Registrasi berhasil namun profil belum tersedia, coba login ulang", 500);
  }

  return sanitizeUser(profile);
};

const login = async ({ email, password }) => {
  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({ email, password });

  if (error || !data?.session) {
    throw new AppError("Email atau password salah", 401);
  }

  const profile = await authRepository.findById(data.user.id);
  if (!profile) {
    throw new AppError("Profil pengguna tidak ditemukan", 404);
  }

  if (!profile.is_active) {
    throw new AppError("Akun Anda telah dinonaktifkan", 403);
  }

  await authRepository.updateLastLogin(profile.id);

  return {
    user: sanitizeUser(profile),
    session: sanitizeSession(data.session),
  };
};

const logout = async (accessToken) => {
  const response = await fetch(`${environment.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: environment.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new AppError("Gagal logout", 400);
  }
};

const getCurrentUser = async (userId) => {
  const profile = await authRepository.findById(userId);
  if (!profile) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }
  const pegawaiId = await authRepository.findPegawaiIdByUserId(userId);
  return { ...sanitizeUser(profile), pegawaiId };
};

const refresh = async (refreshToken) => {
  const { data, error } = await supabaseAuthClient.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data?.session) {
    throw new AppError("Refresh token tidak valid atau kedaluwarsa", 401);
  }

  return sanitizeSession(data.session);
};

module.exports = { register, login, logout, getCurrentUser, refresh };
