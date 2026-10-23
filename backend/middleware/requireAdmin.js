// backend/middleware/requireAdmin.js
// Express middleware: reject requests without a valid admin session.
const { verifySessionToken } = require("../utils/adminTokens");

module.exports = function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No admin token provided." });
  }

  try {
    const payload = verifySessionToken(token);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired admin token." });
  }
};
