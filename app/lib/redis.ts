import { createClient } from "redis";

// Create a singleton Redis client
let redisClient: any = null;

export async function getRedisClient() {
  if (!redisClient) {
    try {
      // Initialize Redis client
      redisClient = createClient({ url: process.env.REDIS_URL });

      // Set up error handler
      redisClient.on("error", (err: any) => {
        console.error("Redis Client Error:", err);
        redisClient = null;
      });

      // Connect to Redis
      await redisClient.connect();
      console.log("Redis client connected successfully");
    } catch (error) {
      console.error("Failed to initialize Redis client:", error);
      redisClient = null;
      throw error;
    }
  }

  return redisClient;
}
