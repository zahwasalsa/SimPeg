const supabaseAuthClient = require("../../config/supabaseAuthClient");
const supabase = require("../../database/supabaseClient");
const AppError = require("../exceptions/appError");

const extractToken = (req) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError("Token akses tidak ditemukan", 401);
    }

    const { data, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !data?.user) {
      throw new AppError("Token tidak valid atau kedaluwarsa", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, role, is_active")
      .eq("id", data.user.id)
      .is("deleted_at", null)
      .single();

    if (profileError || !profile) {
      throw new AppError("Akun pengguna tidak ditemukan", 401);
    }

    if (!profile.is_active) {
      throw new AppError("Akun pengguna telah dinonaktifkan", 403);
    }

    req.user = profile;
    req.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
