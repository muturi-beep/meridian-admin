// backend/routes/auth.js
// Admin login: password → pending token → 2FA → full session token.
const express = require("express");
const bcrypt = require("bcryptjs");
const { authenticator } = require("otplib");

const {
  signPendingToken,
  signSessionToken,
  verifyPendingToken,
} = require("../utils/adminTokens");

const router = express.Router();

// Only one admin email — from env, not from the DB
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || "";

// TOTP clock skew: allow ±1 window (30s each side) to compensate for minor drift
authenticator.options = { window: 1 };

// ══════════════════════════════════════════════════════
// POST /api/auth/login
// Body: { email, password }
// Returns: { stage: 'pending-2fa', pendingToken }
// ══════════════════════════════════════════════════════
router.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    if (String(email).toLowerCase().trim() !== ADMIN_EMAIL) {
      // Same error for wrong email and wrong password — don't leak which was wrong
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(String(password), ADMIN_PASSWORD_HASH);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Password correct → issue pending 2FA token
    const pendingToken = signPendingToken(ADMIN_EMAIL);

    res.json({
      stage: "pending-2fa",
      pendingToken,
      message: "Password verified. Enter your 6-digit authentication code.",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed." });
  }
});

// ══════════════════════════════════════════════════════
// POST /api/auth/verify-2fa
// Body: { pendingToken, code }
// Returns: { token, email }
// ══════════════════════════════════════════════════════
router.post("/api/auth/verify-2fa", async (req, res) => {
  try {
    const { pendingToken, code } = req.body;

    if (!pendingToken || !code) {
      return res
        .status(400)
        .json({ message: "Pending token and code are required." });
    }

    let pending;
    try {
      pending = verifyPendingToken(pendingToken);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Session expired. Please start over." });
    }

    const cleanCode = String(code).replace(/\s/g, "");
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ message: "Code must be 6 digits." });
    }

    const valid = authenticator.check(cleanCode, ADMIN_TOTP_SECRET);
    if (!valid) {
      return res
        .status(401)
        .json({ message: "Invalid or expired authentication code." });
    }

    const token = signSessionToken(pending.email);

    res.json({
      token,
      email: pending.email,
      message: "Welcome. Redirecting to dashboard...",
    });
  } catch (err) {
    console.error("2FA verify error:", err);
    res.status(500).json({ message: "Verification failed." });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/auth/me
// Sanity endpoint — returns who the current token belongs to
// ══════════════════════════════════════════════════════
const requireAdmin = require("../middleware/requireAdmin");
router.get("/api/auth/me", requireAdmin, (req, res) => {
  res.json({ email: req.admin.email });
});

module.exports = router;
