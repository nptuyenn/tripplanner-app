function readPemKey({ rawKey, base64Key, name }) {
  const key = base64Key
    ? Buffer.from(base64Key, "base64").toString("utf8")
    : rawKey?.replaceAll("\\n", "\n");

  if (!key?.includes("BEGIN")) {
    throw new Error(`${name} is required`);
  }

  return key;
}

export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 5001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const mongoUri = environment.AUTH_MONGO_URI ?? environment.MONGO_URI;
  if (!mongoUri) {
    throw new Error("AUTH_MONGO_URI is required");
  }

  const jwtPrivateKey = readPemKey({
    rawKey: environment.JWT_PRIVATE_KEY,
    base64Key: environment.JWT_PRIVATE_KEY_BASE64,
    name: "JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_BASE64",
  });

  return {
    nodeEnv: environment.NODE_ENV ?? "development",
    port,
    serviceName: "auth-service",
    mongoUri,
    redisUrl: environment.REDIS_URL ?? "redis://127.0.0.1:6379",
    jwtPrivateKey,
    jwtKeyId: environment.JWT_KEY_ID,
    jwtExpiresIn: environment.JWT_EXPIRES_IN ?? "1d",
  };
}
