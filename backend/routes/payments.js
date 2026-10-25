// backend/routes/payments.js
// Read-only admin endpoints for the global payments log.
const express = require("express");

const requireAdmin = require("../middleware/requireAdmin");
const Payment = require("../models/Payment");
const Organization = require("../models/Organization");

const router = express.Router();

// ══════════════════════════════════════════════════════
// GET /api/payments-log
// Query params:
//   ?from=YYYY-MM-DD      (inclusive)
//   ?to=YYYY-MM-DD        (inclusive, end-of-day)
//   ?type=Rent|Deposit|Water|Garbage|Service%20Charge|Other
//   ?status=Paid|Pending|Failed|Overdue
//   ?orgId=<objectId>     filter to one org
//   ?search=<text>        matches tenant name or reference
//   ?limit=N              default 200, max 1000
// ══════════════════════════════════════════════════════
router.get("/api/payments-log", requireAdmin, async (req, res) => {
  try {
    const { from, to, type, status, orgId, search, limit = 200 } = req.query;

    const q = {};

    // Date range on `date` field (falls back to createdAt for sort but filter uses date)
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from + "T00:00:00.000Z");
      if (to) {
        const end = new Date(to + "T00:00:00.000Z");
        end.setDate(end.getDate() + 1);
        q.date.$lt = end;
      }
    }

    if (type) q.type = type;
    if (status) q.status = status;
    if (orgId) q.organization = orgId;

    if (search && search.trim()) {
      const safe = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      q.$or = [
        { tenant: { $regex: safe, $options: "i" } },
        { reference: { $regex: safe, $options: "i" } },
        { receiptNumber: { $regex: safe, $options: "i" } },
      ];
    }

    const max = Math.min(Number(limit) || 200, 1000);

    const payments = await Payment.find(q)
      .sort({ date: -1, createdAt: -1 })
      .limit(max)
      .lean();

    // Fetch org names in one query — batch by unique org IDs
    const orgIds = [...new Set(payments.map((p) => String(p.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("name slug")
      .lean();
    const orgById = Object.fromEntries(orgs.map((o) => [String(o._id), o]));

    const enriched = payments.map((p) => ({
      _id: p._id,
      date: p.date || p.createdAt,
      tenant: p.tenant || "",
      tenantId: p.tenantId,
      property: p.property || "",
      unit: p.unit || "",
      amount: p.amount || 0,
      type: p.type || "Rent",
      status: p.status || "",
      method: p.method || "",
      reference: p.reference || "",
      receiptNumber: p.receiptNumber || "",
      organization: p.organization,
      orgName: orgById[String(p.organization)]?.name || "(deleted)",
      orgSlug: orgById[String(p.organization)]?.slug || "",
    }));

    // Summary totals across ALL matches (not just the visible page)
    const agg = await Payment.aggregate([
      { $match: q },
      {
        $group: {
          _id: null,
          totalCollected: {
            $sum: {
              $cond: [{ $eq: ["$status", "Paid"] }, "$amount", 0],
            },
          },
          totalPending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["Pending", "Overdue"]] },
                "$amount",
                0,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = agg[0] || { totalCollected: 0, totalPending: 0, count: 0 };

    res.json({
      payments: enriched,
      summary: {
        totalCollected: summary.totalCollected,
        totalPending: summary.totalPending,
        count: summary.count,
        shown: enriched.length,
      },
    });
  } catch (err) {
    console.error("Payments log error:", err);
    res.status(500).json({ message: "Unable to fetch payments." });
  }
});

// ══════════════════════════════════════════════════════
// GET /api/payments-log/orgs
// Small helper — list of orgs for the filter dropdown.
// ══════════════════════════════════════════════════════
router.get("/api/payments-log/orgs", requireAdmin, async (req, res) => {
  try {
    const orgs = await Organization.find({})
      .select("name slug")
      .sort({ name: 1 })
      .lean();
    res.json({ orgs });
  } catch (err) {
    console.error("Orgs for filter error:", err);
    res.status(500).json({ message: "Unable to fetch orgs." });
  }
});

module.exports = router;
