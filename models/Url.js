const mongoose = require("mongoose");

const UrlSchema = new mongoose.Schema({
  longUrl: {
    type: String,
    required: true
  },
  shortCode: {
    type: String,
    unique: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
});

module.exports = mongoose.model("Url", UrlSchema);
