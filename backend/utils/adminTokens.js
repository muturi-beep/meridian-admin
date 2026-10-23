// backend/utils/adminTokens.js
// Sign/verify JWTs for the admin dashboard.
// Separate secret from the client app — admin sessions are their own world.

const jwt = require("jsonwebtoken");

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const FULL_TTL = "2h"; // full session after 2FA
const PENDING_TTL = "5m"; // short-lived window between password and 2FA

if (!ADMIN_JWT_SECRET) {
  console.error("❌ ADMIN_JWT_SECRET is not set. Add it in .env");
}

function signPendingToken(email) {
  // A token that ONLY proves "password was correct" — not enough to access anything
  return jwt.sign({ email, stage: "pending-2fa" }, ADMIN_JWT_SECRET, {
    expiresIn: PENDING_TTL,
  });
}

function signSessionToken(email) {
  // The full session — proves both password AND 2FA were correct
  return jwt.sign({ email, stage: "authenticated" }, ADMIN_JWT_SECRET, {
    expiresIn: FULL_TTL,
  });
}

function verifyPendingToken(token) {
  const payload = jwt.verify(token, ADMIN_JWT_SECRET);
  if (payload.stage !== "pending-2fa") throw new Error("Not a pending token");
  return payload;
}

function verifySessionToken(token) {
  const payload = jwt.verify(token, ADMIN_JWT_SECRET);
  if (payload.stage !== "authenticated") throw new Error("Not a session token");
  return payload;
}

module.exports = {
  signPendingToken,
  signSessionToken,
  verifyPendingToken,
  verifySessionToken,
};
