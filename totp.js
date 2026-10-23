// totp.js
// Prints the current TOTP code for your ADMIN_TOTP_SECRET.
// Run this any time you log in and need a 6-digit code.
//
// Usage:  node totp.js
//
// The code refreshes every 30 seconds. If it expires before you paste,
// just run it again to get the new one.

require("dotenv").config();
const { authenticator } = require("otplib");

const secret = process.env.ADMIN_TOTP_SECRET;

if (!secret) {
  console.error("\n❌ ADMIN_TOTP_SECRET is not set in .env");
  console.error("   Run generate-secrets.js again or check your .env file.\n");
  process.exit(1);
}

const code = authenticator.generate(secret);
const seconds = Math.floor(Date.now() / 1000);
const remaining = 30 - (seconds % 30);

console.log("");
console.log("╔═════════════════════════════════════╗");
console.log(`║  Current code:  ${code}             ║`);
console.log("╚═════════════════════════════════════╝");
console.log("");
console.log(
  `  Valid for: ${remaining} more second${remaining === 1 ? "" : "s"}`,
);
console.log(`  Refreshes every 30 seconds`);
console.log("");
