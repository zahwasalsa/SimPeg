const path = require("path");
const winston = require("winston");
const environment = require("./environment");

const logsDir = path.join(__dirname, "..", "..", "logs");

const winstonLogger = winston.createLogger({
  level: environment.nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logsDir, "application.log") }),
  ],
});

if (environment.nodeEnv !== "production") {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

module.exports = winstonLogger;
