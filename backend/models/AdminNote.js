// backend/models/AdminNote.js
// Admin-owned notes about an organization. Not part of the client app data.
const mongoose = require("mongoose");

const adminNoteSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true },
    authorEmail: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AdminNote", adminNoteSchema);
