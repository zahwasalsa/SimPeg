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

const getUserById = async (id) => {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw new AppError("Pengguna tidak ditemukan", 404);
  }
  return sanitizeUser(user);
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

module.exports = { listUsers, getUserById, changeRole, changeStatus };
