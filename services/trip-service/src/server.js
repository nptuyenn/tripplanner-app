import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

const config = loadConfig();
const app = createApp({ serviceName: config.serviceName });
const server = app.listen(config.port, () => {
  console.info(`Trip service listening on port ${config.port}`);
});

function shutdown(signal) {
  console.info(`${signal} received; shutting down trip service`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
