require("dotenv").config();
const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const Url = require("./models/Url");
const redisClient = require("./config/redis");

const app = express();

// Connect DB
connectDB();

// Middleware
app.use(express.json());

// Rate limiting for shorten API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use("/api/shorten", limiter);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API Routes (ONLY for shorten)
app.use("/api", require("./routes/url"));


// 🔴 ROOT REDIRECT HANDLER (IMPORTANT)
app.get("/:code", async (req, res) => {
  try {
    const code = req.params.code;
    let cachedUrl = null;

    // 1️⃣ Try Redis (if available)
    try {
      cachedUrl = await redisClient.get(code);
    } catch (redisErr) {
      console.log("Redis not available, skipping cache");
    }

    if (cachedUrl) {
      return res.redirect(cachedUrl);
    }

    // 2️⃣ Fallback to MongoDB
    const url = await Url.findOne({ shortCode: code });
    if (!url) return res.status(404).send("Not found");

    // 3️⃣ Expiry check
    if (url.expiresAt && url.expiresAt < new Date()) {
      return res.status(410).send("Link expired");
    }

    // 4️⃣ Update analytics
    url.clicks++;
    await url.save();

    // 5️⃣ Try to cache in Redis
    try {
      await redisClient.set(code, url.longUrl, { EX: 3600 });
    } catch (redisErr) {
      console.log("Redis not available, skipping cache set");
    }

    return res.redirect(url.longUrl);

  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).send("Server error");
  }
});



// Start Server (KEEP THIS AT BOTTOM)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

