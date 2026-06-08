const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const validUrl = require("valid-url");
const Url = require("../models/Url");
const redisClient = require("../config/redis");

// ===============================
// POST /api/shorten
// Create short URL with hashing + collision handling
// ===============================
router.post("/shorten", async (req, res) => {
  const { longUrl, customCode, expiry } = req.body;

  if (!validUrl.isUri(longUrl)) {
    return res.status(400).json("Invalid URL");
  }

  try {
    let shortCode;

    if (customCode) {
      // Use custom code
      const existing = await Url.findOne({ shortCode: customCode });
      if (existing) return res.status(400).json("Custom alias already taken");
      shortCode = customCode;
    } else {
      // Generate alphanumeric hash-based short code with collision handling
      let collision = true;
      while (collision) {
        const hash = crypto
          .createHash("sha256")
          .update(longUrl + Date.now().toString())
          .digest("base64")                 // base64 gives alphanumeric + symbols
          .replace(/[^a-zA-Z0-9]/g, '')     // remove symbols
          .slice(0, 8);                      // 8-character short code

        const existing = await Url.findOne({ shortCode: hash });
        if (!existing) {
          shortCode = hash;
          collision = false;
        }
      }
    }

    // Handle expiry
    let expiresAt = null;
    if (expiry) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiry));
    }

    const url = new Url({
      longUrl,
      shortCode,
      expiresAt,
    });

    await url.save();

    // Cache the short URL in Redis for faster retrieval
    await redisClient.setEx(shortCode, 3600, longUrl);

    res.json(url);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ===============================
// GET /:shortCode - Redirect to long URL
// ===============================
router.get("/:shortCode", async (req, res) => {
  const { shortCode } = req.params;

  try {
    // Check Redis cache first
    const cachedUrl = await redisClient.get(shortCode);
    if (cachedUrl) {
      // Increment clicks in DB asynchronously
      Url.findOneAndUpdate({ shortCode }, { $inc: { clicks: 1 } }).exec();
      return res.redirect(cachedUrl);
    }

    // Not in cache, fetch from DB
    const url = await Url.findOne({ shortCode });
    if (!url) return res.status(404).json("URL not found");

    // Cache it for 1 hour
    await redisClient.setEx(shortCode, 3600, url.longUrl);

    // Increment clicks
    url.clicks += 1;
    await url.save();

    res.redirect(url.longUrl);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ===============================
// GET /api/analytics/:shortCode - URL Analytics
// ===============================
router.get("/analytics/:shortCode", async (req, res) => {
  const { shortCode } = req.params;

  try {
    const url = await Url.findOne({ shortCode });
    if (!url) return res.status(404).json("URL not found");

    res.json({
      longUrl: url.longUrl,
      shortCode: url.shortCode,
      clicks: url.clicks,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
