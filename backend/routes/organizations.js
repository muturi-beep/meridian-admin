// backend/routes/organizations.js
// Read-only admin endpoints for browsing organizations.
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

// ══════════════════════════════════════════════════════
// GET /api/organizations
// Query params:
//   ?filter=pending   → pending > 24h
//   ?filter=expiring  → trial expiring ≤ 7 days
//   ?filter=inactive  → active/trial with no recent activity
//   ?search=text      → name or slug contains
//   ?sort=name|createdAt|expiresAt|mrr
//   ?order=asc|desc
// ══════════════════════════════════════════════════════
router.get("/api/organizations", requireAdmin, async (req, res) => {
  try {
    const { filter, search, sort = "createdAt", order = "desc" } = req.query;

    // Build the query
    const q = {};
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    if (filter === "pending") {
      q.subscriptionStatus = "pending";
      q.createdAt = { $lt: oneDayAgo };
    } else if (filter === "expiring") {
      q.subscriptionStatus = "trial";
      q.subscriptionExpiresAt = { $gte: now, $lte: weekFromNow };
    } else if (filter === "inactive") {
      q.subscriptionStatus = { $in: ["active", "trial"] };
      q.createdAt = { $lt: twoWeeksAgo };
    }

    if (search && search.trim()) {
      const safe = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      q.$or = [
        { name: { $regex: safe, $options: "i" } },
        { slug: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ];
    }

    // Sort
    const sortField = [
      "name",
      "createdAt",
      "subscriptionExpiresAt",
      "subscriptionStatus",
    ].includes(sort)
      ? sort
      : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortOrder };

    const orgs = await Organization.find(q).sort(sortObj).limit(500).lean();

    // Enrich with counts (parallel, one query per org per count)
    const enriched = await Promise.all(
      orgs.map(async (o) => {
        const [userCount, propCount, unitCount, sub] = await Promise.all([
          User.countDocuments({ organization: o._id }),
          Property.countDocuments({ organization: o._id }),
          Unit.countDocuments({ organization: o._id }),
          o.currentSubscription
            ? Subscription.findById(o.currentSubscription).lean()
            : null,
        ]);

        const daysLeft = o.subscriptionExpiresAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(o.subscriptionExpiresAt) - now) /
                  (24 * 60 * 60 * 1000),
              ),
            )
          : 0;

        return {
          _id: o._id,
          name: o.name,
          slug: o.slug,
          type: o.type || "",
          email: o.email || "",
          createdAt: o.createdAt,
          subscriptionStatus: o.subscriptionStatus || "none",
          subscriptionExpiresAt: o.subscriptionExpiresAt || null,
          plan: sub?.plan || null,
          daysLeft,
          userCount,
          propCount,
          unitCount,
        };
      }),
    );

    res.json({ organizations: enriched, count: enriched.length });
  } catch (err) {
    console.error("Organizations list error:", err);
    res.status(500).json({ message: "Unable to fetch organizations." });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/organizations/:id
// Full detail for one org.
// ══════════════════════════════════════════════════════
router.get("/api/organizations/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid organization ID." });
    }

    const org = await Organization.findById(req.params.id).lean();
    if (!org)
      return res.status(404).json({ message: "Organization not found." });

    const [users, properties, units, subscriptions, payments] =
      await Promise.all([
        User.find({ organization: org._id })
          .select("-password")
          .sort({ createdAt: 1 })
          .lean(),
        Property.find({ organization: org._id }).sort({ createdAt: -1 }).lean(),
        Unit.find({ organization: org._id }).sort({ createdAt: -1 }).lean(),
        Subscription.find({ organization: org._id })
          .sort({ createdAt: -1 })
          .lean(),
        Payment.find({ organization: org._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
      ]);

    res.json({
      organization: org,
      users,
      properties,
      units,
      subscriptions,
      payments,
      stats: {
        userCount: users.length,
        propCount: properties.length,
        unitCount: units.length,
        subscriptionCount: subscriptions.length,
        paymentCount: payments.length,
      },
    });
  } catch (err) {
    console.error("Organization detail error:", err);
    res.status(500).json({ message: "Unable to fetch organization." });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/users/search
// Query: ?q=text&role=...&limit=N
// Searches name, email, phone. Returns enriched user list.
// ══════════════════════════════════════════════════════
router.get("/api/users/search", requireAdmin, async (req, res) => {
  try {
    const { q, role, limit = 50 } = req.query;

    const query = {};

    if (q && String(q).trim()) {
      const safe = String(q)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { email: { $regex: safe, $options: "i" } },
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    if (role) query.role = role;

    const max = Math.min(Number(limit) || 50, 200);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(max)
      .lean();

    // Enrich with org name
    const orgIds = [...new Set(users.map((u) => String(u.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("name slug")
      .lean();
    const orgById = Object.fromEntries(orgs.map((o) => [String(o._id), o]));

    const enriched = users.map((u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      createdAt: u.createdAt,
      organization: u.organization,
      orgName: orgById[String(u.organization)]?.name || "(deleted)",
      orgSlug: orgById[String(u.organization)]?.slug || "",
    }));

    res.json({ users: enriched, count: enriched.length });
  } catch (err) {
    console.error("User search error:", err);
    res.status(500).json({ message: "Unable to search users." });
  }
});

module.exports = router;
