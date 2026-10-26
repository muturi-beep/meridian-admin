// backend/routes/notes.js
// Admin-only notes per organization. Read + write.
const express = require("express");
const mongoose = require("mongoose");

const requireAdmin = require("../middleware/requireAdmin");
const AdminNote = require("../models/AdminNote");

const router = express.Router();

// ══════════════════════════════════════════════════════
// GET /api/organizations/:orgId/notes
// ══════════════════════════════════════════════════════
router.get(
  "/api/organizations/:orgId/notes",
  requireAdmin,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.orgId)) {
        return res.status(400).json({ message: "Invalid organization ID." });
      }
      const notes = await AdminNote.find({ organization: req.params.orgId })
        .sort({ createdAt: -1 })
        .lean();
      res.json({ notes });
    } catch (err) {
      console.error("List notes error:", err);
      res.status(500).json({ message: "Unable to fetch notes." });
    }
  },
);

// ══════════════════════════════════════════════════════
// POST /api/organizations/:orgId/notes
// ══════════════════════════════════════════════════════
router.post(
  "/api/organizations/:orgId/notes",
  requireAdmin,
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.orgId)) {
        return res.status(400).json({ message: "Invalid organization ID." });
      }

      const body = String(req.body.body || "").trim();
      if (!body)
        return res.status(400).json({ message: "Note body is required." });
      if (body.length > 5000)
        return res
          .status(400)
          .json({ message: "Note too long (5000 chars max)." });

      const note = await new AdminNote({
        organization: req.params.orgId,
        body,
        authorEmail: req.admin?.email || "admin",
      }).save();

      res.status(201).json({ note });
    } catch (err) {
      console.error("Create note error:", err);
      res.status(500).json({ message: "Unable to save note." });
    }
  },
);

// ══════════════════════════════════════════════════════
// DELETE /api/organizations/:orgId/notes/:noteId
// ══════════════════════════════════════════════════════
router.delete(
  "/api/organizations/:orgId/notes/:noteId",
  requireAdmin,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(req.params.orgId) ||
        !mongoose.Types.ObjectId.isValid(req.params.noteId)
      ) {
        return res.status(400).json({ message: "Invalid IDs." });
      }

      const deleted = await AdminNote.findOneAndDelete({
        _id: req.params.noteId,
        organization: req.params.orgId,
      });

      if (!deleted) return res.status(404).json({ message: "Note not found." });
      res.json({ message: "Note deleted." });
    } catch (err) {
      console.error("Delete note error:", err);
      res.status(500).json({ message: "Unable to delete note." });
    }
  },
);

module.exports = router;
