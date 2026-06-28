import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from "./config/database.js";
import { loadConfig } from "./config/env.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";

const config = loadConfig();
let redisClient;
let server;

async function start() {
  await connectDatabase(config.mongoUri);
  redisClient = await connectRedis(config.redisUrl);

  const app = createApp({
    config,
    redisClient,
    readinessCheck: async () => ({
      mongo: isDatabaseReady(),
      redis: redisClient.isReady,
    }),
  });

  server = app.listen(config.port, () => {
    console.info(`TripPlanner backend listening on port ${config.port}`);
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down`);

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
  console.error("Backend failed to start:", error);
  await Promise.allSettled([
    disconnectRedis(redisClient),
    mongoose.disconnect(),
  ]);
  process.exit(1);
});
