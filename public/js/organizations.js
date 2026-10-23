// public/js/organizations.js
// Organizations list page.

let allOrgs = [];
let currentSearch = "";

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

function planLabel(plan) {
  if (!plan) return '<span class="muted">—</span>';
  const map = {
    free: "Free",
    basic: "Basic",
    professional: "Professional",
    enterprise: "Enterprise",
  };
  return map[plan] || plan;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function loadOrganizations() {
  const el = document.getElementById("content");
  el.innerHTML = '<div class="loading">Loading organizations...</div>';

  const filter = document.getElementById("filter").value;
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (currentSearch) params.set("search", currentSearch);

  // Update page title based on filter
  const titles = {
    "": [
      "Organizations",
      "All agencies and property managers on the platform.",
    ],
    pending: [
      "Pending Payment",
      "Orgs that signed up but haven't paid in over 24 hours.",
    ],
    expiring: [
      "Expiring Trials",
      "Trials ending in the next 7 days — time to reach out.",
    ],
    inactive: [
      "Inactive Organizations",
      "Active orgs with no recent activity.",
    ],
  };
  const [title, sub] = titles[filter] || titles[""];
  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageSub").textContent = sub;

  try {
    const data = await api("/api/organizations?" + params.toString());
    allOrgs = data.organizations;
    renderList(data.organizations, filter);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not load organizations</h2>
        <p>${err.message}</p>
        <button onclick="loadOrganizations()">Retry</button>
      </div>`;
  }
}

function renderList(orgs, filter) {
  const el = document.getElementById("content");

  if (!orgs.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-title">No organizations match</div>
        <div class="empty-desc">${filter ? "Try clearing the filter or search." : "No orgs exist yet."}</div>
      </div>`;
    return;
  }

  const rows = orgs
    .map(
      (o) => `
    <tr onclick="window.location.href='/organizations.html?id=${o._id}'">
      <td>
        <div class="org-name">${o.name}</div>
        <div class="org-slug">${o.slug}</div>
      </td>
      <td>${planLabel(o.plan)}</td>
      <td>${statusPill(o.subscriptionStatus)}</td>
      <td>
        ${o.daysLeft > 0 ? `<span class="days-left ${o.daysLeft <= 7 ? "warn" : ""}">${o.daysLeft}d</span>` : '<span class="muted">—</span>'}
      </td>
      <td class="num">${o.userCount}</td>
      <td class="num">${o.propCount}</td>
      <td class="num">${o.unitCount}</td>
      <td class="muted">${fmtDate(o.createdAt)}</td>
      <td class="arrow">→</td>
    </tr>`,
    )
    .join("");

  el.innerHTML = `
    <div class="table-card">
      <div class="table-head">
        <div class="table-title">${orgs.length} organization${orgs.length === 1 ? "" : "s"}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Days Left</th>
              <th>Users</th>
              <th>Properties</th>
              <th>Units</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

let searchTimer = null;
function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = document.getElementById("search").value.trim();
    loadOrganizations();
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  const s = getSession();
  if (s?.email) document.getElementById("adminEmail").textContent = s.email;

  // Read ?id= in URL to open the detail modal
  const params = new URLSearchParams(window.location.search);
  if (params.get("id")) {
    window.location.href = "/organization.html?id=" + params.get("id");
    return;
  }

  // Read filter from URL (from Quick Links on dashboard)
  const filter = params.get("filter");
  if (filter) document.getElementById("filter").value = filter;

  loadOrganizations();
});
