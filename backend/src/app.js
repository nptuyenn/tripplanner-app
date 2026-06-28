import compression from "compression";
import express from "express";
import helmet from "helmet";
import { User } from "./models/User.js";
import { Trip } from "./models/Trip.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { createMetrics } from "./middleware/metrics.js";
import { createAuthRateLimiter } from "./middleware/rateLimiter.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createTripRouter } from "./routes/tripRoutes.js";
import { createAuthService } from "./services/authService.js";
import { createCacheService } from "./services/cacheService.js";
import { createTripService } from "./services/tripService.js";
import { asyncHandler } from "./utils/asyncHandler.js";

export function createApp({
  config,
  redisClient = null,
  readinessCheck = async () => ({ mongo: false, redis: false }),
  authService = createAuthService(User, config),
  tripService = createTripService(Trip),
} = {}) {
  const app = express();
  const metrics = createMetrics();
  const cache = createCacheService(redisClient);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "32kb" }));
  app.use(metrics.middleware);

  app.get("/healthz", (request, response) => {
    void request;
    response.json({ status: "ok" });
  });

  app.get(
    "/readyz",
    asyncHandler(async (request, response) => {
      void request;
      const checks = await readinessCheck();
      const ready = Object.values(checks).every(Boolean);
      response.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "not_ready",
        checks,
      });
    }),
  );

  app.get(
    "/metrics",
    asyncHandler(async (request, response) => {
      void request;
      response.set("Content-Type", metrics.registry.contentType);
      response.send(await metrics.registry.metrics());
    }),
  );

  app.use(
    "/api/auth",
    createAuthRateLimiter(redisClient),
    createAuthRouter(authService),
  );
  app.use(
    "/api/trips",
    createTripRouter({
      tripService,
      cache,
      requireAuth: requireAuth(config.jwtSecret),
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
