import { createClient } from "redis";

export async function connectRedis(url) {
  const client = createClient({ url });
  client.on("error", (error) => {
    console.warn("Trip Redis client error:", error.message);
  });

  await client.connect();
  return client;
}

export async function disconnectRedis(client) {
  if (client?.isOpen) {
    await client.quit();
  }
}
