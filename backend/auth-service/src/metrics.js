import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

export function createMetrics(serviceName) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry, prefix: "tripplanner_auth_" });

  const requestCounter = new Counter({
    name: "tripplanner_auth_http_requests_total",
    help: "Total HTTP requests handled by the auth service",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: "tripplanner_auth_http_request_duration_seconds",
    help: "Auth service HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  function middleware(request, response, next) {
    const stopTimer = requestDuration.startTimer();

    response.on("finish", () => {
      const labels = {
        method: request.method,
        route: request.route?.path ?? request.path,
        status_code: response.statusCode,
      };
      requestCounter.inc(labels);
      stopTimer(labels);
    });

    next();
  }

  return { registry, middleware };
}
