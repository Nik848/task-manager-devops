import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { httpRequestDuration, httpRequestCount } from "./metrics.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import userRoutes from "./routes/users.js";
import healthRoutes from "./routes/health.js";
import metricsRoutes from "./routes/metrics.js";

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: true }));

// Prometheus metrics middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };
    end(labels);
    httpRequestCount.inc(labels);
  });
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/health", healthRoutes);
app.use("/metrics", metricsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info({ port: config.port }, "Server started");
});
