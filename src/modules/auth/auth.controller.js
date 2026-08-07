const authService = require("./auth.service");
const responseHelper = require("../../shared/responses/responseHelper");

const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.register({ email, password });
    responseHelper.success(res, { statusCode: 201, message: "Registrasi berhasil", data: user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    responseHelper.success(res, { message: "Login berhasil", data: result });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.authToken);
    responseHelper.success(res, { message: "Logout berhasil", data: {} });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    responseHelper.success(res, { message: "OK", data: user });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const session = await authService.refresh(refreshToken);
    responseHelper.success(res, { message: "Token diperbarui", data: session });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, me, refresh };
