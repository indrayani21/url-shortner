const redis = require("redis");

let client;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL
  });

  client.on("error", (err) => console.log("Redis Client Error", err));

  client.connect()
    .then(() => console.log("Redis connected"))
    .catch(err => console.log("Redis connection failed:", err));
} else {
  console.log("REDIS_URL not set. Redis disabled.");

  // Dummy Redis client with same API so code won't crash
  client = {
    get: async (key) => null,
    setEx: async (key, ttl, value) => {
      return; // do nothing
    }
  };
}

module.exports = client;

