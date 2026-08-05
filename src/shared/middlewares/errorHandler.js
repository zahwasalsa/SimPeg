const logger = require("../logger/logger");
const responseHelper = require("../responses/responseHelper");

const notFoundHandler = (req, res) => {
  responseHelper.error(res, { statusCode: 404, message: "Endpoint tidak ditemukan" });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.isOperational ? err.statusCode : 500;
  const message = err.isOperational ? err.message : "Terjadi kesalahan pada server";

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
  } else {
    logger.warn(err.message, { path: req.originalUrl, method: req.method });
  }

  responseHelper.error(res, { statusCode, message, errors: err.errors || null });
};

module.exports = { notFoundHandler, errorHandler };
