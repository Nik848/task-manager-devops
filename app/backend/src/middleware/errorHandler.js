import { logger } from "../logger.js";
import { config } from "../config.js";

export function errorHandler(err, req, res, _next) {
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  const status = err.status || err.statusCode || 500;
  const message =
    status < 500 || config.nodeEnv !== "production"
      ? err.message
      : "Internal server error";

  res.status(status).json({
    error: message,
  });
}
