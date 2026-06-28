import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

export function createAuthRateLimiter(redisClient) {
  const store = redisClient?.isReady
    ? new RedisStore({
        prefix: "tripplanner:rate-limit:",
        sendCommand: (...args) => redisClient.sendCommand(args),
      })
    : undefined;

  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store,
    message: { message: "Too many authentication attempts; try again later" },
  });
}
