import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "tripplanner_" });

  const requestCounter = new Counter({
    name: "tripplanner_http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: "tripplanner_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  function middleware(request, response, next) {
    const stopTimer = requestDuration.startTimer();

    response.on("finish", () => {
      const route = request.route?.path
        ? `${request.baseUrl}${request.route.path}`
        : request.path;
      const labels = {
        method: request.method,
        route,
        status_code: response.statusCode,
      };

      requestCounter.inc(labels);
      stopTimer(labels);
    });

    next();
  }

  return { registry, middleware };
}
