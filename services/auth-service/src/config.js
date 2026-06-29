export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 5001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const mongoUri = environment.AUTH_MONGO_URI ?? environment.MONGO_URI;
  if (!mongoUri) {
    throw new Error("AUTH_MONGO_URI is required");
  }

  const jwtSecret = environment.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return {
    nodeEnv: environment.NODE_ENV ?? "development",
    port,
    serviceName: "auth-service",
    mongoUri,
    redisUrl: environment.REDIS_URL ?? "redis://127.0.0.1:6379",
    jwtSecret,
    jwtExpiresIn: environment.JWT_EXPIRES_IN ?? "1d",
  };
}
