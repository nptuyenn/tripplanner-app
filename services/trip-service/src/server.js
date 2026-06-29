import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from "./database.js";
import { connectRedis, disconnectRedis } from "./redis.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const config = loadConfig();
let redisClient;
let server;

async function start() {
  await connectDatabase(config.mongoUri);
  redisClient = await connectRedis(config.redisUrl);

  const app = createApp({
    config,
    redisClient,
    serviceName: config.serviceName,
    readinessCheck: async () => ({
      mongo: isDatabaseReady(),
      redis: redisClient.isReady,
    }),
  });

  server = app.listen(config.port, () => {
    console.info(`Trip service listening on port ${config.port}`);
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down trip service`);

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await Promise.allSettled([
    disconnectRedis(redisClient),
    disconnectDatabase(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch(async (error) => {
  console.error("Trip service failed to start:", error);
  await Promise.allSettled([
    disconnectRedis(redisClient),
    mongoose.disconnect(),
  ]);
  process.exit(1);
});
