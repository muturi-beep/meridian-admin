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
    const [data, mrr] = await Promise.all([
      api("/api/stats/overview"),
      api("/api/stats/mrr-history").catch(() => ({ months: [] })),
    ]);
    renderOverview(data, mrr);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not load dashboard</h2>
        <p>${err.message}</p>
        <button onclick="loadOverview()">Retry</button>
      </div>`;
  }
}

function renderOverview(data, mrrData) {
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

    ${renderMrrChart(mrrData)}

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

// ══════════════════════════════════════════════════════
// MRR chart (inline SVG, no dependencies)
// ══════════════════════════════════════════════════════
function renderMrrChart(mrrData) {
  const months = mrrData.months || [];

  if (!months.length) return "";

  const totals = months.map((m) => m.total);
  const max = Math.max(...totals, 1); // avoid division by zero
  const allZero = totals.every((v) => v === 0);

  const cardStyle = `
    background: var(--ink-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 32px;
  `;

  if (allZero) {
    return `
      <div style="${cardStyle}">
        <h2 style="font-size:16px;color:#fff;margin-bottom:4px;">Monthly Recurring Revenue</h2>
        <p class="muted" style="font-size:12.5px;margin-bottom:20px;">Revenue from active paid subscriptions over time</p>
        <div style="text-align:center;padding:40px 20px;color:var(--t2);font-size:13px;">
          No paid subscriptions yet — MRR will appear here once you have active paid plans.
        </div>
      </div>`;
  }

  // Chart dimensions
  const W = 800,
    H = 220;
  const PAD_L = 60,
    PAD_R = 20,
    PAD_T = 20,
    PAD_B = 40;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const stepX = chartW / Math.max(months.length - 1, 1);
  const yFor = (v) => PAD_T + chartH - (v / max) * chartH;

  // Build path points
  const points = months.map((m, i) => ({
    x: PAD_L + i * stepX,
    y: yFor(m.total),
    value: m.total,
    label: m.label,
  }));

  // Smooth-ish path: line segments
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  // Area fill under the line
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`;

  // Y-axis gridlines (4 levels)
  const gridLevels = [0, 0.25, 0.5, 0.75, 1];
  const gridLines = gridLevels
    .map((pct) => {
      const v = max * pct;
      const y = yFor(v);
      return `
      <line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="${PAD_L - 8}" y="${y + 4}" text-anchor="end" fill="#7a83a0" font-size="10" font-family="inherit">
        ${v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)}
      </text>`;
    })
    .join("");

  // X-axis labels
  const xLabels = points
    .map(
      (p) => `
    <text x="${p.x}" y="${H - 15}" text-anchor="middle" fill="#7a83a0" font-size="11" font-family="inherit">${p.label}</text>
  `,
    )
    .join("");

  // Data points
  const dots = points
    .map(
      (p) => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="#d4a46a" stroke="#131722" stroke-width="2">
      <title>${p.label}: ${fmtKES(p.value)}</title>
    </circle>
  `,
    )
    .join("");

  // Endpoint value (highlight the latest)
  const last = points[points.length - 1];

  return `
    <div style="${cardStyle}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:16px;color:#fff;margin-bottom:4px;">Monthly Recurring Revenue</h2>
          <p class="muted" style="font-size:12.5px;">Revenue from active paid subscriptions over time</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);font-weight:600;margin-bottom:2px;">Current</div>
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:var(--copper-l);">${fmtKES(last.value)}</div>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#b8834a" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#b8834a" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaPath}" fill="url(#mrrGradient)"/>
        <path d="${linePath}" fill="none" stroke="#d4a46a" stroke-width="2.5" stroke-linejoin="round"/>
        ${dots}
        ${xLabels}
      </svg>
    </div>`;
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  const s = getSession();
  if (s?.email) {
    const el = document.getElementById("adminEmail");
    if (el) el.textContent = s.email;
  }
  loadOverview();
});
