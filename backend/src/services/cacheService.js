export function createCacheService(redisClient) {
  return {
    async get(key) {
      if (!redisClient?.isReady) return null;

      try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn("Redis cache read failed:", error.message);
        return null;
      }
    },

    async set(key, value, ttlSeconds = 60) {
      if (!redisClient?.isReady) return;

      try {
        await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
      } catch (error) {
        console.warn("Redis cache write failed:", error.message);
      }
    },

    async delete(key) {
      if (!redisClient?.isReady) return;

      try {
        await redisClient.del(key);
      } catch (error) {
        console.warn("Redis cache delete failed:", error.message);
      }
    },
  };
}
