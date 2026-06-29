import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTestJwtKeys } from "./jwtKeys.js";

const { privateKey, publicKey } = createTestJwtKeys();

const config = {
  jwtPublicKey: publicKey,
};

function dependencies(overrides = {}) {
  return {
    config,
    readinessCheck: async () => ({ mongo: true, redis: true }),
    tripService: {
      list: vi.fn(async () => []),
      create: vi.fn(async (owner, data) => ({ _id: "trip-1", owner, ...data })),
      update: vi.fn(async (owner, id, data) => ({ _id: id, owner, ...data })),
      remove: vi.fn(async (owner, id) => ({ _id: id, owner })),
    },
    ...overrides,
  };
}

function bearerToken(userId = "user-1") {
  return `Bearer ${jwt.sign({ sub: userId }, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
  })}`;
}

describe("trip service API", () => {
  it("reports liveness and readiness", async () => {
    const app = createApp(dependencies());

    const health = await request(app).get("/healthz").expect(200);
    expect(health.body).toMatchObject({ service: "trip-service", status: "ok" });

    const ready = await request(app).get("/readyz").expect(200);
    expect(ready.body).toMatchObject({
      service: "trip-service",
      status: "ready",
      checks: { mongo: true, redis: true },
    });
  });

  it("rejects unauthenticated requests", async () => {
    const app = createApp(dependencies());
    await request(app).get("/api/trips").expect(401);
  });

  it("rejects tokens signed with unsupported algorithms", async () => {
    const app = createApp(dependencies());
    const hs256Token = jwt.sign(
      { sub: "user-1" },
      "legacy-shared-secret-that-should-not-work",
      { algorithm: "HS256", expiresIn: "1h" },
    );

    await request(app)
      .get("/api/trips")
      .set("Authorization", `Bearer ${hs256Token}`)
      .expect(401);
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
