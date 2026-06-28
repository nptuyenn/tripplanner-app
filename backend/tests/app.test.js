import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const config = {
  jwtSecret: "test-secret-that-is-long-enough-for-tests",
  jwtExpiresIn: "1h",
};

function dependencies(overrides = {}) {
  return {
    config,
    readinessCheck: async () => ({ mongo: true, redis: true }),
    authService: {
      register: vi.fn(async ({ name, email }) => ({
        token: "register-token",
        user: { id: "user-1", name, email },
      })),
      login: vi.fn(async ({ email }) => ({
        token: "login-token",
        user: { id: "user-1", name: "Test User", email },
      })),
    },
    tripService: {
      list: vi.fn(async () => []),
      create: vi.fn(async (owner, data) => ({ _id: "trip-1", owner, ...data })),
      update: vi.fn(async (owner, id, data) => ({ _id: id, owner, ...data })),
      remove: vi.fn(async (owner, id) => ({ _id: id, owner })),
    },
    ...overrides,
  };
}

function bearerToken() {
  return `Bearer ${jwt.sign({ sub: "user-1" }, config.jwtSecret, { expiresIn: "1h" })}`;
}

describe("operational endpoints", () => {
  it("reports liveness and readiness independently", async () => {
    const app = createApp(dependencies());

    await request(app).get("/healthz").expect(200, { status: "ok" });
    await request(app).get("/readyz").expect(200, {
      status: "ready",
      checks: { mongo: true, redis: true },
    });
  });

  it("returns 503 when a dependency is unavailable", async () => {
    const app = createApp(
      dependencies({
        readinessCheck: async () => ({ mongo: true, redis: false }),
      }),
    );

    const response = await request(app).get("/readyz").expect(503);
    expect(response.body.status).toBe("not_ready");
  });

  it("exposes Prometheus metrics", async () => {
    const app = createApp(dependencies());
    const response = await request(app).get("/metrics").expect(200);

    expect(response.text).toContain("tripplanner_http_request_duration_seconds");
    expect(response.headers["content-type"]).toContain("text/plain");
  });
});

describe("authentication API", () => {
  it("validates registration input", async () => {
    const app = createApp(dependencies());
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "invalid", password: "short" })
      .expect(400);

    expect(response.body.details).toHaveLength(3);
  });

  it("registers and logs in a user", async () => {
    const deps = dependencies();
    const app = createApp(deps);

    const registration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      })
      .expect(201);
    expect(registration.body.token).toBe("register-token");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" })
      .expect(200);
    expect(login.body.token).toBe("login-token");
  });
});

describe("trips API", () => {
  it("rejects unauthenticated requests", async () => {
    const app = createApp(dependencies());
    await request(app).get("/api/trips").expect(401);
  });

  it("lists and creates trips for the authenticated owner", async () => {
    const deps = dependencies();
    deps.tripService.list.mockResolvedValueOnce([
      { _id: "trip-1", destination: "Da Nang" },
    ]);
    const app = createApp(deps);

    const list = await request(app)
      .get("/api/trips")
      .set("Authorization", bearerToken())
      .expect(200);
    expect(list.body.trips[0].destination).toBe("Da Nang");

    const created = await request(app)
      .post("/api/trips")
      .set("Authorization", bearerToken())
      .send({
        destination: "Hoi An",
        startDate: "2026-07-10",
        endDate: "2026-07-13",
        notes: "Food tour",
      })
      .expect(201);
    expect(created.body.trip.owner).toBe("user-1");
  });

  it("validates dates and handles missing trips", async () => {
    const deps = dependencies();
    deps.tripService.update.mockResolvedValueOnce(null);
    deps.tripService.remove.mockResolvedValueOnce(null);
    const app = createApp(deps);

    const invalid = await request(app)
      .post("/api/trips")
      .set("Authorization", bearerToken())
      .send({
        destination: "Hue",
        startDate: "2026-08-10",
        endDate: "2026-08-01",
      })
      .expect(400);
    expect(invalid.body.details).toContain("End date must be on or after start date");

    await request(app)
      .put("/api/trips/missing")
      .set("Authorization", bearerToken())
      .send({ notes: "Updated" })
      .expect(404);

    await request(app)
      .delete("/api/trips/missing")
      .set("Authorization", bearerToken())
      .expect(404);
  });

  it("updates and deletes owned trips", async () => {
    const app = createApp(dependencies());

    const updated = await request(app)
      .put("/api/trips/trip-1")
      .set("Authorization", bearerToken())
      .send({ status: "completed" })
      .expect(200);
    expect(updated.body.trip.status).toBe("completed");

    await request(app)
      .delete("/api/trips/trip-1")
      .set("Authorization", bearerToken())
      .expect(204);
  });
});
