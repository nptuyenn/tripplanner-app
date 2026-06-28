const requiredInProduction = ["MONGO_URI", "JWT_SECRET"];

export function loadConfig(environment = process.env) {
  const config = {
    nodeEnv: environment.NODE_ENV ?? "development",
    port: Number(environment.PORT ?? 5000),
    mongoUri: environment.MONGO_URI,
    redisUrl: environment.REDIS_URL ?? "redis://localhost:6379",
    jwtSecret: environment.JWT_SECRET ?? "development-only-secret-change-me",
    jwtExpiresIn: environment.JWT_EXPIRES_IN ?? "1d",
  };

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  if (config.nodeEnv === "production") {
    const missing = requiredInProduction.filter((key) => !environment[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    if (config.jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters in production");
    }
  }

  return config;
}
