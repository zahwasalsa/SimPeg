const app = require("./app");
const environment = require("./config/environment");
const logger = require("./shared/logger/logger");

const server = app.listen(environment.port, () => {
  logger.info(`Server running on port ${environment.port} [${environment.nodeEnv}]`);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", { reason: reason?.message || reason });
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { message: err.message, stack: err.stack });
  process.exit(1);
});
