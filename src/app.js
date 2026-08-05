const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const environment = require("./config/environment");
const logger = require("./shared/logger/logger");
const responseHelper = require("./shared/responses/responseHelper");
const { notFoundHandler, errorHandler } = require("./shared/middlewares/errorHandler");
const routes = require("./routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: environment.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

app.get("/health", (req, res) => {
  responseHelper.success(res, { message: "Service is healthy", data: { status: "ok" } });
});

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
