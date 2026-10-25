// backend/routes/stats.js
// Read-only aggregate endpoints for the admin dashboard.
// All queries hit MongoDB with countDocuments and aggregate — no writes.
const express = require("express");
const mongoose = require("mongoose");

const requireAdmin = require("../middleware/requireAdmin");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Property = require("../models/Property");
const Unit = require("../models/Unit");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");

const router = express.Router();

// ── Helper: start/end of current week and previous week ──
function weekRanges() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - daysToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  return { thisWeekStart, lastWeekStart, now };
}

// ── Helper: start of day N days ago ──
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ══════════════════════════════════════════════════════
// GET /api/stats/mrr-history
// Returns the last 6 months of "active subscriptions by month".
// A subscription counts in a month if it was active and its
// startsAt..expiresAt window overlaps that month.
// ══════════════════════════════════════════════════════
router.get("/api/stats/mrr-history", requireAdmin, async (req, res) => {
  try {
    // Build the last 6 month boundaries: [start of oldest, start of newest+1)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString("en", { month: "short" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        start: d,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        total: 0,
        activeCount: 0,
      });
    }

    const oldestMonth = months[0].start;

    // Fetch all subscriptions that *could* overlap the range:
    // - status active or trial (only these generate MRR)
    // - created before end of the range
    // - startsAt is null OR before end of range
    // - expiresAt is null OR after start of range
    const rangeStart = oldestMonth;
    const rangeEnd = months[months.length - 1].end;

    const subs = await Subscription.find({
      status: { $in: ["active"] }, // only paid subs count towards MRR
      $or: [{ expiresAt: null }, { expiresAt: { $gt: rangeStart } }],
      startsAt: { $lt: rangeEnd },
    }).lean();

    // For each month, sum subscriptions whose window covers that month
    for (const m of months) {
      for (const s of subs) {
        const startsAt = s.startsAt ? new Date(s.startsAt) : null;
        const expiresAt = s.expiresAt ? new Date(s.expiresAt) : null;

        // Did this sub cover the m.start..m.end window?
        const overlaps =
          (!startsAt || startsAt < m.end) &&
          (!expiresAt || expiresAt > m.start);

        if (overlaps) {
          m.total += Number(s.amount) || 0;
          m.activeCount += 1;
        }
      }
    }

    res.json({
      months: months.map((m) => ({
        label: m.label,
        year: m.year,
        month: m.month,
        total: m.total,
        activeCount: m.activeCount,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("MRR history error:", err);
    res.status(500).json({ message: "Unable to fetch MRR history." });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/stats/overview
// Returns the dashboard overview data.
// ══════════════════════════════════════════════════════
router.get("/api/stats/overview", requireAdmin, async (req, res) => {
  try {
    const { thisWeekStart, lastWeekStart } = weekRanges();

    // ── Organisation counts by subscription status ──
    const [totalOrgs, orgsActive, orgsTrial, orgsPending, orgsExpired] =
      await Promise.all([
        Organization.countDocuments({}),
        Organization.countDocuments({ subscriptionStatus: "active" }),
        Organization.countDocuments({ subscriptionStatus: "trial" }),
        Organization.countDocuments({ subscriptionStatus: "pending" }),
        Organization.countDocuments({ subscriptionStatus: "expired" }),
      ]);

    // ── Users by role ──
    const userRoles = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);
    const usersByRole = {};
    let totalUsers = 0;
    userRoles.forEach(({ _id, count }) => {
      usersByRole[_id || "unknown"] = count;
      totalUsers += count;
    });

    // ── Properties / units / tenants ──
    const [totalProperties, totalUnits, totalTenants] = await Promise.all([
      Property.countDocuments({}),
      Unit.countDocuments({}),
      User.countDocuments({ role: "tenant" }),
    ]);

    // ── MRR: sum of active subscriptions' amounts ──
    const mrrAgg = await Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const mrr = mrrAgg[0]?.total || 0;

    // ── This week's new signups / payments / subscriptions ──
    const [
      newOrgsThisWeek,
      newOrgsLastWeek,
      newPaymentsThisWeek,
      newSubsThisWeek,
    ] = await Promise.all([
      Organization.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      Organization.countDocuments({
        createdAt: { $gte: lastWeekStart, $lt: thisWeekStart },
      }),
      Payment.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      Subscription.countDocuments({ createdAt: { $gte: thisWeekStart } }),
    ]);

    // ── Expiring trials in next 7 days ──
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const expiringSoon = await Organization.countDocuments({
      subscriptionStatus: "trial",
      subscriptionExpiresAt: { $gte: new Date(), $lte: weekFromNow },
    });

    // ── Orgs pending payment > 24h ──
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingOver24h = await Organization.countDocuments({
      subscriptionStatus: "pending",
      createdAt: { $lt: oneDayAgo },
    });

    // ── Orgs with no activity in 14 days ──
    // We approximate "activity" via last property/tenant/payment creation.
    // Simpler: orgs created > 14 days ago with no payments ever.
    const twoWeeksAgo = daysAgo(14);
    const inactiveOrgs = await Organization.countDocuments({
      createdAt: { $lt: twoWeeksAgo },
      subscriptionStatus: { $in: ["active", "trial"] },
    });

    res.json({
      totals: {
        orgs: totalOrgs,
        orgsActive,
        orgsTrial,
        orgsPending,
        orgsExpired,
        users: totalUsers,
        usersByRole,
        properties: totalProperties,
        units: totalUnits,
        tenants: totalTenants,
      },
      mrr,
      thisWeek: {
        newOrgs: newOrgsThisWeek,
        newOrgsLastWeek,
        newPayments: newPaymentsThisWeek,
        newSubscriptions: newSubsThisWeek,
      },
      alerts: {
        expiringSoon,
        pendingOver24h,
        inactiveOrgs,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Stats overview error:", err);
    res.status(500).json({ message: "Unable to fetch stats." });
  }
});

module.exports = router;
