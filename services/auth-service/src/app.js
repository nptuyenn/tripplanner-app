import compression from "compression";
import express from "express";
import helmet from "helmet";
import { User } from "./models/User.js";
import { createAuthRateLimiter } from "./middleware/rateLimiter.js";
import { createMetrics } from "./metrics.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createAuthService } from "./services/authService.js";

export function createApp({
  config,
  redisClient = null,
  serviceName = "auth-service",
  readinessCheck = async () => ({ service: true }),
  authService = createAuthService(User, config),
} = {}) {
  const app = express();
  const metrics = createMetrics(serviceName);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "32kb" }));
  app.use(metrics.middleware);

  app.get("/healthz", (request, response) => {
    void request;
    response.json({ service: serviceName, status: "ok" });
  });

  app.get("/readyz", async (request, response, next) => {
    void request;
    try {
      const checks = await readinessCheck();
      const ready = Object.values(checks).every(Boolean);
      response.status(ready ? 200 : 503).json({
        service: serviceName,
        status: ready ? "ready" : "not_ready",
        checks,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/metrics", async (request, response, next) => {
    void request;
    try {
      response.set("Content-Type", metrics.registry.contentType);
      response.send(await metrics.registry.metrics());
    } catch (error) {
      next(error);
    }
  });

  app.use(
    "/api/auth",
    createAuthRateLimiter(redisClient),
    createAuthRouter(authService),
  );

  app.use((request, response) => {
    response.status(404).json({
      message: `Route ${request.method} ${request.originalUrl} not found`,
    });
  });

  app.use((error, request, response, next) => {
    void request;
    void next;

    if (error.name === "ValidationError") {
      return response.status(400).json({
        message: "Validation failed",
        details: Object.values(error.errors).map((item) => item.message),
      });
    }

    if (error.code === 11000) {
      return response.status(409).json({ message: "Resource already exists" });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      console.error(error);
    }

    return response.status(statusCode).json({
      message: statusCode >= 500 ? "Internal server error" : error.message,
    });
  });

  return app;
}
