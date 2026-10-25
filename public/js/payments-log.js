// public/js/payments-log.js
// Global payments log page.

let currentSearch = "";
let allOrgsLoaded = false;

function fmtKES(n) {
  return "KES " + (Number(n) || 0).toLocaleString("en-KE");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusPill(status) {
  const map = {
    Paid: "ok",
    Pending: "warn",
    Overdue: "danger",
    Failed: "danger",
  };
  return `<span class="pill pill-${map[status] || "mute"}">${status}</span>`;
}

function typePill(type) {
  const map = {
    Rent: "info",
    Deposit: "ok",
  };
  return map[type]
    ? `<span class="pill pill-${map[type]}">${type}</span>`
    : `<span class="pill pill-mute">${type || "—"}</span>`;
}

async function loadOrgFilter() {
  if (allOrgsLoaded) return;
  try {
    const data = await api("/api/payments-log/orgs");
    const sel = document.getElementById("filterOrg");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">All Organizations</option>' +
      data.orgs
        .map((o) => `<option value="${o._id}">${escapeHtml(o.name)}</option>`)
        .join("");
    sel.value = current;
    allOrgsLoaded = true;
  } catch (err) {
    console.warn("Could not load orgs for filter:", err.message);
  }
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

async function loadPayments() {
  const el = document.getElementById("content");
  el.innerHTML = '<div class="loading">Loading payments...</div>';

  const params = new URLSearchParams();
  if (currentSearch) params.set("search", currentSearch);
  if (document.getElementById("from").value)
    params.set("from", document.getElementById("from").value);
  if (document.getElementById("to").value)
    params.set("to", document.getElementById("to").value);
  if (document.getElementById("filterType").value)
    params.set("type", document.getElementById("filterType").value);
  if (document.getElementById("filterStatus").value)
    params.set("status", document.getElementById("filterStatus").value);
  if (document.getElementById("filterOrg").value)
    params.set("orgId", document.getElementById("filterOrg").value);

  try {
    const data = await api("/api/payments-log?" + params.toString());
    renderSummary(data.summary);
    renderTable(data.payments);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not load payments</h2>
        <p>${escapeHtml(err.message)}</p>
        <button onclick="loadPayments()">Retry</button>
      </div>`;
  }
}

function renderSummary(s) {
  document.getElementById("summary").innerHTML = `
    <div class="stats-row small">
      <div class="stat-card">
        <div class="stat-label">Total Collected</div>
        <div class="stat-value" style="color:var(--green);">${fmtKES(s.totalCollected)}</div>
        <div class="stat-sub">Across all matched payments</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Pending</div>
        <div class="stat-value" style="color:var(--amber);">${fmtKES(s.totalPending)}</div>
        <div class="stat-sub">Pending + Overdue</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Records</div>
        <div class="stat-value">${s.count}</div>
        <div class="stat-sub">Showing ${s.shown}${s.shown < s.count ? ` (limit ${s.shown})` : ""}</div>
      </div>
    </div>`;
}

function renderTable(payments) {
  const el = document.getElementById("content");

  if (!payments.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-title">No payments match</div>
        <div class="empty-desc">Try adjusting the filters or clearing the search.</div>
      </div>`;
    return;
  }

  const rows = payments
    .map(
      (p) => `
    <tr onclick="window.location.href='/organization.html?id=${p.organization}'">
      <td class="muted">${fmtDate(p.date)}</td>
      <td>
        <div class="org-name">${escapeHtml(p.orgName)}</div>
        <div class="org-slug">${escapeHtml(p.orgSlug || "")}</div>
      </td>
      <td>${escapeHtml(p.tenant || "—")}</td>
      <td>${typePill(p.type)}</td>
      <td class="num" style="font-weight:600;">${fmtKES(p.amount)}</td>
      <td>${statusPill(p.status)}</td>
      <td class="muted">${escapeHtml(p.method || "—")}</td>
      <td class="muted" style="font-family:monospace;font-size:11.5px;">${escapeHtml(p.receiptNumber || p.reference || "—")}</td>
      <td class="arrow">→</td>
    </tr>`,
    )
    .join("");

  el.innerHTML = `
    <div class="table-card">
      <div class="table-head">
        <div class="table-title">${payments.length} payment${payments.length === 1 ? "" : "s"}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Organization</th>
              <th>Tenant</th>
              <th>Type</th>
              <th style="text-align:right">Amount</th>
              <th>Status</th>
              <th>Method</th>
              <th>Receipt / Ref</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

let searchTimer = null;
function debouncedLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = document.getElementById("search").value.trim();
    loadPayments();
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  const s = getSession();
  if (s?.email) document.getElementById("adminEmail").textContent = s.email;

  // Prefill date range with last 30 days
  const today = new Date();
  const thirtyAgo = new Date();
  thirtyAgo.setDate(today.getDate() - 30);
  document.getElementById("from").value = thirtyAgo.toISOString().slice(0, 10);
  document.getElementById("to").value = today.toISOString().slice(0, 10);

  loadOrgFilter().then(() => loadPayments());
});
