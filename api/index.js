// api/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : "*";

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ── DB connection middleware ──
const { connectDB } = require("../backend/config/db");

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connect error:", err.message);
    return res.status(500).json({ message: "Database connection failed." });
  }
});

// Serve static files only for local dev — Vercel serves /public automatically
if (require.main === module) {
  app.use(express.static(path.join(__dirname, "..", "public")));
}

// Health check
app.get(["/api/health", "/health"], (req, res) => {
  res.json({
    ok: true,
    service: "meridian-admin",
    time: new Date().toISOString(),
  });
});

// Admin auth routes
const authRoutes = require("../backend/routes/auth");
app.use(authRoutes);

// Admin stats
const statsRoutes = require("../backend/routes/stats");
app.use(statsRoutes);

// Admin organizations
const organizationsRoutes = require("../backend/routes/organizations");
app.use(organizationsRoutes);

// Placeholder for future routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) {
    return res.status(404).json({ message: "Route not found", path: req.path });
  }
  next();
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`✅ Admin dashboard running on http://localhost:${PORT}`);
  });
}
