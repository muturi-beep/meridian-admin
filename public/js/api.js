// public/js/api.js
// Fetch helper for the admin dashboard — attaches the session token.

const API_BASE = "";

function getSession() {
  try {
    const raw = localStorage.getItem("admin_session");
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Session is 2h — if older, treat as expired
    if (s.savedAt && Date.now() - s.savedAt > 2 * 60 * 60 * 1000) {
      localStorage.removeItem("admin_session");
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

async function api(path, opts = {}) {
  const s = getSession();
  if (!s || !s.token) {
    window.location.href = "/";
    throw new Error("No session");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    Authorization: "Bearer " + s.token,
  };

  const res = await fetch(API_BASE + path, { ...opts, headers });

  if (res.status === 401) {
    localStorage.removeItem("admin_session");
    window.location.href = "/";
    throw new Error("Session expired");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

function logout() {
  localStorage.removeItem("admin_session");
  window.location.href = "/";
}
