import { describe, expect, it, vi } from "vitest";
import { createCacheService } from "../src/services/cacheService.js";

describe("trip cache service", () => {
  it("serializes values and reads them back", async () => {
    const values = new Map();
    const redis = {
      isReady: true,
      get: vi.fn(async (key) => values.get(key) ?? null),
      set: vi.fn(async (key, value) => values.set(key, value)),
      del: vi.fn(async (key) => values.delete(key)),
    };
    const cache = createCacheService(redis);

    await cache.set("trips:cache:user-1", [{ id: 1 }], 30);
    expect(await cache.get("trips:cache:user-1")).toEqual([{ id: 1 }]);

    await cache.delete("trips:cache:user-1");
    expect(await cache.get("trips:cache:user-1")).toBeNull();
  });

  it("degrades gracefully when Redis is unavailable", async () => {
    const cache = createCacheService(null);

    expect(await cache.get("missing")).toBeNull();
    await expect(cache.set("key", "value")).resolves.toBeUndefined();
    await expect(cache.delete("key")).resolves.toBeUndefined();
  });
});
