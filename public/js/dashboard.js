// public/js/dashboard.js
// Renders the admin overview.

function fmtKES(n) {
  return "KES " + (Number(n) || 0).toLocaleString("en-KE");
}

function fmtNumber(n) {
  return (Number(n) || 0).toLocaleString();
}

function card(label, value, sub, cls = "") {
  return `
    <div class="stat-card ${cls}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ""}
    </div>`;
}

function alertRow(severity, title, count, path) {
  if (!count) return "";
  return `
    <a class="alert-row ${severity}" href="${path}">
      <span class="alert-dot"></span>
      <span class="alert-title">${title}</span>
      <span class="alert-count">${count}</span>
      <span class="alert-arrow">→</span>
    </a>`;
}

async function loadOverview() {
  const el = document.getElementById("content");
  el.innerHTML = '<div class="loading">Loading dashboard...</div>';

  try {
    const data = await api("/api/stats/overview");
    renderOverview(data);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not load dashboard</h2>
        <p>${err.message}</p>
        <button onclick="loadOverview()">Retry</button>
      </div>`;
  }
}

function renderOverview(data) {
  const t = data.totals;
  const w = data.thisWeek;
  const a = data.alerts;

  const signupDelta = w.newOrgs - w.newOrgsLastWeek;
  const signupDeltaLabel =
    signupDelta > 0
      ? `▲ +${signupDelta} vs last week`
      : signupDelta < 0
        ? `▼ ${signupDelta} vs last week`
        : "Same as last week";

  const html = `
    <div class="page-head">
      <div>
        <h1>Overview</h1>
        <p class="muted">Snapshot of the entire system. Updated ${new Date(data.generatedAt).toLocaleTimeString()}.</p>
      </div>
      <button class="btn-outline" onclick="loadOverview()">↻ Refresh</button>
    </div>

    <div class="stats-row">
      ${card("Total Organizations", fmtNumber(t.orgs), `${t.orgsActive} active · ${t.orgsTrial} trial`)}
      ${card("Monthly Recurring Revenue", fmtKES(data.mrr), "Active subscriptions", "highlight")}
      ${card("Total Users", fmtNumber(t.users), `${t.tenants} tenants · ${(t.users || 0) - t.tenants} managers`)}
      ${card("Properties", fmtNumber(t.properties), `${t.units} units across all orgs`)}
    </div>

    <div class="stats-row small">
      ${card("New Signups", fmtNumber(w.newOrgs), signupDeltaLabel)}
      ${card("New Payments", fmtNumber(w.newPayments), `Since Monday`)}
      ${card("New Subscriptions", fmtNumber(w.newSubscriptions), `Since Monday`)}
      ${card("Expiring Soon", fmtNumber(a.expiringSoon), "Within 7 days", a.expiringSoon > 0 ? "warn" : "")}
    </div>

    ${
      a.pendingOver24h + a.expiringSoon + a.inactiveOrgs > 0
        ? `
      <div class="section">
        <h2>Needs Attention</h2>
        <div class="alerts">
          ${alertRow("danger", "Orgs pending payment > 24 hours", a.pendingOver24h, "/organizations.html?filter=pending")}
          ${alertRow("warn", "Orgs with expiring trials (≤ 7 days)", a.expiringSoon, "/organizations.html?filter=expiring")}
          ${alertRow("info", "Orgs with no activity in 14 days", a.inactiveOrgs, "/organizations.html?filter=inactive")}
        </div>
      </div>`
        : ""
    }

    <div class="section">
      <h2>Quick Links</h2>
      <div class="quick-links">
        <a href="/organizations.html" class="quick-link">
          <div class="ql-icon">🏢</div>
          <div>
            <div class="ql-title">Organizations</div>
            <div class="ql-desc">Browse all ${t.orgs} orgs</div>
          </div>
        </a>
        <a href="/organizations.html?filter=pending" class="quick-link">
          <div class="ql-icon">⏳</div>
          <div>
            <div class="ql-title">Pending Payments</div>
            <div class="ql-desc">${a.pendingOver24h} need follow-up</div>
          </div>
        </a>
        <a href="/organizations.html?filter=expiring" class="quick-link">
          <div class="ql-icon">⏰</div>
          <div>
            <div class="ql-title">Expiring Trials</div>
            <div class="ql-desc">${a.expiringSoon} in next 7 days</div>
          </div>
        </a>
      </div>
    </div>
  `;

  document.getElementById("content").innerHTML = html;
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  // Show logged-in email
  const s = getSession();
  if (s?.email) {
    const el = document.getElementById("adminEmail");
    if (el) el.textContent = s.email;
  }
  loadOverview();
});
