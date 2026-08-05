const winstonLogger = require("../../config/logger");

const logger = {
  info: (message, meta) => winstonLogger.info(message, meta),
  warn: (message, meta) => winstonLogger.warn(message, meta),
  error: (message, meta) => winstonLogger.error(message, meta),
  debug: (message, meta) => winstonLogger.debug(message, meta),
};

module.exports = logger;
