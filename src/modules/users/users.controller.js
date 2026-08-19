const usersService = require("./users.service");
const responseHelper = require("../../shared/responses/responseHelper");

const list = async (req, res, next) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { users, pagination } = await usersService.listUsers({ page, limit });
    responseHelper.paginated(res, {
      message: "Daftar user",
      data: users,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
    });
  } catch (err) {
    next(err);
  }
};

const detail = async (req, res, next) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    responseHelper.success(res, { message: "Detail user", data: user });
  } catch (err) {
    next(err);
  }
};

const changeEmail = async (req, res, next) => {
  try {
    const user = await usersService.changeEmail({
      targetId: req.params.id,
      email: req.body.email,
      actorId: req.user.id,
    });
    responseHelper.success(res, { message: "Email berhasil diubah", data: user });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    await usersService.changePassword({
      targetId: req.params.id,
      password: req.body.password,
      actorId: req.user.id,
    });
    responseHelper.success(res, { message: "Password berhasil diubah", data: null });
  } catch (err) {
    next(err);
  }
};

const changeRole = async (req, res, next) => {
  try {
    const user = await usersService.changeRole({
      targetId: req.params.id,
      role: req.body.role,
      actorId: req.user.id,
    });
    responseHelper.success(res, { message: "Role berhasil diubah", data: user });
  } catch (err) {
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const user = await usersService.changeStatus({
      targetId: req.params.id,
      isActive: req.body.isActive,
      actorId: req.user.id,
    });
    responseHelper.success(res, { message: "Status berhasil diubah", data: user });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await usersService.deleteUser({ targetId: req.params.id, actorId: req.user.id });
    responseHelper.success(res, { message: "User berhasil dihapus", data: null });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, detail, changeEmail, changePassword, changeRole, changeStatus, remove };
