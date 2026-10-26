// public/js/organization.js
// Organization detail page.

function statusPill(status) {
  const map = {
    active: "ok",
    trial: "info",
    pending: "warn",
    expired: "danger",
    none: "mute",
  };
  return `<span class="pill pill-${map[status] || "mute"}">${status}</span>`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtKES(n) {
  return "KES " + (Number(n) || 0).toLocaleString("en-KE");
}

function roleLabel(role) {
  const map = {
    "agency-director": "Agency Director",
    "property-manager": "Property Manager",
    "finance-officer": "Finance Officer",
    "maintenance-staff": "Maintenance Staff",
    "leasing-agent": "Leasing Agent",
    tenant: "Tenant",
    auditor: "Auditor",
  };
  return map[role] || role;
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

async function loadOrganization() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    window.location.href = "/organizations.html";
    return;
  }

  const el = document.getElementById("content");
  el.innerHTML = '<div class="loading">Loading organization...</div>';

  try {
    const data = await api("/api/organizations/" + id);
    renderDetail(data);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not load organization</h2>
        <p>${err.message}</p>
        <button onclick="window.location.href='/organizations.html'">Back to list</button>
      </div>`;
  }
}

function renderDetail(data) {
  const o = data.organization;
  const s = data.stats;

  const html = `
    <div class="page-head">
      <div>
        <h1>${o.name}</h1>
        <div class="org-meta">
          ${o.type ? `<span>${o.type}</span> · ` : ""}
          <span>Created ${fmtDate(o.createdAt)}</span>
          ${o.email ? ` · <span>${o.email}</span>` : ""}
        </div>
      </div>
      <div>${statusPill(o.subscriptionStatus || "none")}</div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Current Plan</div>
        <div class="stat-value">${o.subscriptionStatus === "trial" ? "Free Trial" : data.subscriptions[0]?.plan || "—"}</div>
        <div class="stat-sub">${o.subscriptionStatus}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Users</div>
        <div class="stat-value">${s.userCount}</div>
        <div class="stat-sub">${data.users.filter((u) => u.role !== "tenant").length} staff · ${data.users.filter((u) => u.role === "tenant").length} tenants</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Properties</div>
        <div class="stat-value">${s.propCount}</div>
        <div class="stat-sub">${s.unitCount} units total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Payments</div>
        <div class="stat-value">${s.paymentCount}</div>
        <div class="stat-sub">Recorded total</div>
      </div>
    </div>

    <div class="section">
      <h2>Subscription History</h2>
      ${
        data.subscriptions.length
          ? `
        <div class="table-card">
          <table>
            <thead><tr><th>Plan</th><th>Status</th><th>Amount</th><th>Starts</th><th>Expires</th><th>Receipt</th></tr></thead>
            <tbody>${data.subscriptions
              .map(
                (sub) => `
              <tr>
                <td>${sub.plan}</td>
                <td>${statusPill(sub.status === "active" ? "active" : sub.status === "trial" ? "trial" : sub.status)}</td>
                <td>${fmtKES(sub.amount)}</td>
                <td>${fmtDate(sub.startsAt)}</td>
                <td>${fmtDate(sub.expiresAt)}</td>
                <td class="muted">${sub.mpesaReceiptNumber || "—"}</td>
              </tr>`,
              )
              .join("")}
            </tbody>
          </table>
        </div>`
          : '<div class="empty-small">No subscription history.</div>'
      }
    </div>

    <div class="section">
      <h2>Users (${data.users.length})</h2>
      ${
        data.users.length
          ? `
        <div class="table-card">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phone</th><th>Created</th></tr></thead>
            <tbody>${data.users
              .map(
                (u) => `
              <tr>
                <td>${u.firstName} ${u.lastName}</td>
                <td class="muted">${u.email}</td>
                <td>${roleLabel(u.role)}</td>
                <td class="muted">${u.phone || "—"}</td>
                <td class="muted">${fmtDate(u.createdAt)}</td>
              </tr>`,
              )
              .join("")}
            </tbody>
          </table>
        </div>`
          : '<div class="empty-small">No users yet.</div>'
      }
    </div>

    <div class="section">
      <h2>Properties (${data.properties.length})</h2>
      ${
        data.properties.length
          ? `
        <div class="table-card">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>${data.properties
              .map(
                (p) => `
              <tr>
                <td>${p.name}</td>
                <td>${p.type || "—"}</td>
                <td class="muted">${p.location || "—"}</td>
                <td>${statusPill(p.status === "Active" ? "active" : "none")}</td>
                <td class="muted">${fmtDate(p.createdAt)}</td>
              </tr>`,
              )
              .join("")}
            </tbody>
          </table>
        </div>`
          : '<div class="empty-small">No properties yet.</div>'
      }
    </div>

    <div class="section">
      <h2>Recent Payments (${data.payments.length})</h2>
      ${
        data.payments.length
          ? `
        <div class="table-card">
          <table>
            <thead><tr><th>Date</th><th>Tenant</th><th>Type</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>${data.payments
              .map(
                (p) => `
              <tr>
                <td class="muted">${fmtDateTime(p.date || p.createdAt)}</td>
                <td>${p.tenant || "—"}</td>
                <td>${p.type || "Rent"}</td>
                <td>${fmtKES(p.amount)}</td>
                <td>${statusPill(p.status === "Paid" ? "active" : p.status === "Failed" ? "expired" : "pending")}</td>
                <td class="muted">${p.receiptNumber || "—"}</td>
              </tr>`,
              )
              .join("")}
            </tbody>
          </table>
        </div>`
          : '<div class="empty-small">No payments yet.</div>'
      }
    </div>

    <div class="section" id="notesSection">
      <h2>Internal Notes</h2>
      <div class="notes-card">
        <div class="notes-form">
          <textarea
            id="noteBody"
            placeholder="Write a note about this client... (called on X, wants upgrade in Y, referred by Z)"
            maxlength="5000"
          ></textarea>
          <div class="notes-actions">
            <span class="notes-hint">Private — only you can see this</span>
            <button class="btn-outline" id="noteSubmitBtn" onclick="submitNote()">Save Note</button>
          </div>
        </div>
        <div id="notesList" class="notes-list">
          <div class="muted" style="text-align:center;padding:20px;">Loading notes...</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("content").innerHTML = html;

  loadNotes();
}

// ══════════════════════════════════════════════════════
// NOTES
// ══════════════════════════════════════════════════════

function fmtRelative(d) {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 30) return days + "d ago";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function loadNotes() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get("id");
  if (!orgId) return;

  const el = document.getElementById("notesList");
  if (!el) return;

  try {
    const data = await api("/api/organizations/" + orgId + "/notes");
    renderNotes(data.notes);
  } catch (err) {
    el.innerHTML = `<div class="muted" style="text-align:center;padding:20px;">Could not load notes: ${escapeHtml(err.message)}</div>`;
  }
}

function renderNotes(notes) {
  const el = document.getElementById("notesList");
  if (!el) return;

  if (!notes.length) {
    el.innerHTML = `<div class="muted" style="text-align:center;padding:24px;">No notes yet. Add your first one above.</div>`;
    return;
  }

  el.innerHTML = notes
    .map(
      (n) => `
      <div class="note-item">
        <div class="note-head">
          <span class="note-author">${escapeHtml(n.authorEmail || "admin")}</span>
          <span class="note-time">${fmtRelative(n.createdAt)}</span>
          <button class="note-delete" onclick="deleteNote('${n._id}')" title="Delete note">×</button>
        </div>
        <div class="note-body">${escapeHtml(n.body).replace(/\n/g, "<br>")}</div>
      </div>`,
    )
    .join("");
}

async function submitNote() {
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get("id");
  if (!orgId) return;

  const textarea = document.getElementById("noteBody");
  const btn = document.getElementById("noteSubmitBtn");
  const body = textarea.value.trim();

  if (!body) {
    textarea.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    await api("/api/organizations/" + orgId + "/notes", {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    textarea.value = "";
    await loadNotes();
  } catch (err) {
    alert("Could not save note: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Note";
  }
}

async function deleteNote(noteId) {
  if (!confirm("Delete this note?")) return;
  const params = new URLSearchParams(window.location.search);
  const orgId = params.get("id");
  if (!orgId) return;

  try {
    await api("/api/organizations/" + orgId + "/notes/" + noteId, {
      method: "DELETE",
    });
    await loadNotes();
  } catch (err) {
    alert("Could not delete note: " + err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  const s = getSession();
  if (s?.email) document.getElementById("adminEmail").textContent = s.email;
  loadOrganization();
});
