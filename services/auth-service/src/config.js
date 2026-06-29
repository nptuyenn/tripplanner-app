export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 5001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    nodeEnv: environment.NODE_ENV ?? "development",
    port,
    serviceName: "auth-service",
  };
}
