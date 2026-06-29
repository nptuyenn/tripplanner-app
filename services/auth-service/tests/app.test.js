import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTestJwtKeys } from "./jwtKeys.js";

const { privateKey } = createTestJwtKeys();

const config = {
  jwtPrivateKey: privateKey,
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
    ...overrides,
  };
}

describe("auth service API", () => {
  it("reports liveness and readiness", async () => {
    const app = createApp(dependencies());

    const health = await request(app).get("/healthz").expect(200);
    expect(health.body).toMatchObject({ service: "auth-service", status: "ok" });

    const ready = await request(app).get("/readyz").expect(200);
    expect(ready.body).toMatchObject({
      service: "auth-service",
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
