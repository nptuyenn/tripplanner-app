import compression from "compression";
import express from "express";
import helmet from "helmet";
import { createMetrics } from "./metrics.js";

export function createApp({
  serviceName = "auth-service",
  readinessCheck = async () => ({ service: true }),
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

  app.use((request, response) => {
    response.status(404).json({
      message: `Route ${request.method} ${request.originalUrl} not found`,
    });
  });

  app.use((error, request, response, next) => {
    void request;
    void next;
    console.error(error);
    response.status(500).json({ message: "Internal server error" });
  });

  return app;
}
