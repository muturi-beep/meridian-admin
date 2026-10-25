// public/js/users.js
// Global user search.

let currentSearch = "";

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  return map[role] || role || "—";
}

function rolePill(role) {
  const map = {
    "agency-director": "ok",
    "property-manager": "info",
    "finance-officer": "info",
    "maintenance-staff": "warn",
    "leasing-agent": "info",
    tenant: "mute",
    auditor: "mute",
  };
  return `<span class="pill pill-${map[role] || "mute"}">${roleLabel(role)}</span>`;
}

async function loadUsers() {
  const el = document.getElementById("content");
  el.innerHTML = '<div class="loading">Searching users...</div>';

  const params = new URLSearchParams();
  if (currentSearch) params.set("q", currentSearch);
  if (document.getElementById("filterRole").value) {
    params.set("role", document.getElementById("filterRole").value);
  }

  try {
    const data = await api("/api/users/search?" + params.toString());
    renderTable(data.users);
  } catch (err) {
    el.innerHTML = `
      <div class="error-box">
        <h2>Could not search users</h2>
        <p>${escapeHtml(err.message)}</p>
        <button onclick="loadUsers()">Retry</button>
      </div>`;
  }
}

function renderTable(users) {
  const el = document.getElementById("content");

  if (!users.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-title">${currentSearch ? "No users match" : "No users yet"}</div>
        <div class="empty-desc">${currentSearch ? "Try a different search term or clear the role filter." : "No users have been created yet."}</div>
      </div>`;
    return;
  }

  const rows = users
    .map(
      (u) => `
    <tr onclick="window.location.href='/organization.html?id=${u.organization}'">
      <td>
        <div class="org-name">${escapeHtml((u.firstName || "") + " " + (u.lastName || ""))}</div>
        <div class="org-slug">${escapeHtml(u.email)}</div>
      </td>
      <td>${rolePill(u.role)}</td>
      <td>
        <div class="org-name">${escapeHtml(u.orgName)}</div>
        <div class="org-slug">${escapeHtml(u.orgSlug || "")}</div>
      </td>
      <td class="muted">${escapeHtml(u.phone || "—")}</td>
      <td class="muted">${fmtDate(u.createdAt)}</td>
      <td class="arrow">→</td>
    </tr>`,
    )
    .join("");

  el.innerHTML = `
    <div class="table-card">
      <div class="table-head">
        <div class="table-title">${users.length} user${users.length === 1 ? "" : "s"}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Organization</th>
              <th>Phone</th>
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
    loadUsers();
  }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!getSession()) {
    window.location.href = "/";
    return;
  }
  const s = getSession();
  if (s?.email) document.getElementById("adminEmail").textContent = s.email;
  loadUsers();
});
