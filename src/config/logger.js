const path = require("path");
const winston = require("winston");
const environment = require("./environment");

// Vercel's filesystem is read-only outside /tmp — the code runs from
// /var/task, so a File transport's mkdir for logs/ fails with ENOENT.
// Vercel sets this env var on every deployment, so it's a reliable switch.
const isVercel = Boolean(process.env.VERCEL);

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

let transports;

if (isVercel) {
  // Vercel Runtime Logs capture stdout/stderr, not files on disk — same
  // structured format as the file transports below, just redirected.
  transports = [new winston.transports.Console({ format: baseFormat })];
} else {
  const logsDir = path.join(__dirname, "..", "..", "logs");
  transports = [
    new winston.transports.File({ filename: path.join(logsDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logsDir, "application.log") }),
  ];
}

const winstonLogger = winston.createLogger({
  level: environment.nodeEnv === "production" ? "info" : "debug",
  format: baseFormat,
  transports,
});

if (!isVercel && environment.nodeEnv !== "production") {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

module.exports = winstonLogger;
