const supabaseAdmin = require("../../config/supabase");
const usersRepository = require("./users.repository");
const AppError = require("../../shared/exceptions/appError");
const logger = require("../../shared/logger/logger");

// Never include password_hash or any token/secret field here.
const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  isActive: row.is_active,
  lastLogin: row.last_login,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listUsers = async ({ page, limit }) => {
  const { data, total } = await usersRepository.findAll({ page, limit });
  return {
    users: data.map(sanitizeUser),
    pagination: { page, limit, total },
  };
};

// `pegawai` is attached (id + namaLengkap only, never the full profile) so
// the Manajemen User "Edit" form can show/edit the linked pegawai's name
// without a second lookup call — null when this account has no pegawai
// profile yet (registration only creates the users row, not pegawai).
const getUserById = async (id) => {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }
  const pegawai = await usersRepository.findPegawaiByUserId(id);
  return {
    ...sanitizeUser(user),
    pegawai: pegawai ? { id: pegawai.id, namaLengkap: pegawai.nama_lengkap } : null,
  };
};

// Email exists in two places that are only ever synced once, at account
// creation, by the on_auth_user_created trigger (INSERT only — see
// 017_auth_user_link_trigger.sql): auth.users.email (what login actually
// checks) and public.users.email (the mirror column everything else reads).
// Both must be written here, in order: auth.users first (the source of
// truth — if this fails, nothing has changed), then public.users. If the
// second write fails after the first already succeeded, the auth.users
// email is reverted so the two never drift out of sync with each other.
//
// Duplicate emails are checked proactively against public.users *before*
// calling Supabase Auth, rather than by parsing the error Auth returns —
// confirmed live that a taken email doesn't come back as a clean 409/422
// from GoTrue. It surfaces as a raw HTTP 500 with a Postgres unique-
// violation body (`"users_email_partial_key"`), and the supabase-js client
// mangles that further into an `AuthRetryableFetchError` with an empty
// message, so there is nothing reliable to pattern-match there.
const changeEmail = async ({ targetId, email, actorId }) => {
  const existing = await usersRepository.findById(targetId);
  if (!existing) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }

  if (email === existing.email) {
    return sanitizeUser(existing);
  }

  const emailOwner = await usersRepository.findByEmail(email);
  if (emailOwner && emailOwner.id !== targetId) {
    throw new AppError("Email sudah digunakan oleh akun lain", 409);
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetId, { email });
  if (authError) {
    logger.error("Supabase admin.updateUserById (email) failed", { targetId, message: authError.message });
    throw new AppError("Gagal mengubah email", 400);
  }

  let updated;
  try {
    updated = await usersRepository.updateEmail(targetId, email);
  } catch (err) {
    await supabaseAdmin.auth.admin.updateUserById(targetId, { email: existing.email }).catch((revertErr) => {
      logger.error("Gagal mengembalikan email auth.users setelah update public.users gagal", {
        targetId,
        error: revertErr.message,
      });
    });
    throw err;
  }

  logger.info("User email changed", { targetId, actorId });
  return sanitizeUser(updated);
};

// Password lives exclusively in auth.users.encrypted_password — Supabase
// Auth owns it entirely (see 016_users_password_hash_nullable.sql:
// "We must never store/hash passwords ourselves in public.users going
// forward"). Nothing to write on the public.users side.
const changePassword = async ({ targetId, password, actorId }) => {
  const existing = await usersRepository.findById(targetId);
  if (!existing) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, { password });
  if (error) {
    logger.error("Supabase admin.updateUserById (password) failed", { targetId, message: error.message });
    throw new AppError("Gagal mengubah password", 400);
  }

  logger.info("User password changed by admin", { targetId, actorId });
};

const changeRole = async ({ targetId, role, actorId }) => {
  const existing = await usersRepository.findById(targetId);
  if (!existing) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }

  const updated = await usersRepository.updateRole(targetId, role);
  logger.info("User role changed", {
    targetId,
    previousRole: existing.role,
    newRole: role,
    actorId,
  });
  return sanitizeUser(updated);
};

const changeStatus = async ({ targetId, isActive, actorId }) => {
  const existing = await usersRepository.findById(targetId);
  if (!existing) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }

  const updated = await usersRepository.updateStatus(targetId, isActive);
  logger.info("User status changed", { targetId, isActive, actorId });
  return sanitizeUser(updated);
};

// Self-delete is blocked outright (not just warned, unlike self-deactivate)
// since it's the one action here that isn't reversible through the app UI —
// only PATCH /users/:id/status has a self-lockout warning-but-allow path.
const deleteUser = async ({ targetId, actorId }) => {
  if (targetId === actorId) {
    throw new AppError("Anda tidak dapat menghapus akun Anda sendiri", 400);
  }

  const existing = await usersRepository.findById(targetId);
  if (!existing) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }

  const deleted = await usersRepository.softDelete(targetId);
  if (!deleted) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }
  logger.info("User deleted", { targetId, actorId });
};

module.exports = {
  listUsers,
  getUserById,
  changeEmail,
  changePassword,
  changeRole,
  changeStatus,
  deleteUser,
};
