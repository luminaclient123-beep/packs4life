// Packs4Life — shared client logic

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

// Deterministic 4x4 pixel glyph per pack/user, so every card gets a
// recognizable little "block" icon without anyone drawing it by hand.
function pixelIconHTML(seed, cellPx) {
  const px = cellPx || 5;
  const h = hashStr(String(seed || "pack"));
  let cells = "";
  for (let i = 0; i < 16; i++) {
    const on = (h >> i) & 1;
    const bg = on ? "var(--green)" : "var(--line)";
    cells += `<i style="background:${bg};opacity:${on ? 0.85 : 0.4}"></i>`;
  }
  return `<div class="pixel-icon" style="grid-template-columns:repeat(4,${px}px);grid-template-rows:repeat(4,${px}px);">${cells}</div>`;
}

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function timeAgo(iso) {
  if (!iso) return "some time ago";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function fetchPacks() {
  const res = await fetch("/api/packs");
  if (!res.ok) throw new Error("Could not load packs");
  return res.json();
}

function packCardHTML(p) {
  return `
    <a class="card" href="/pack.html?id=${encodeURIComponent(p.id)}">
      <div class="card-top">
        <span class="tag">${escapeHTML(p.version || "v1")}</span>
        ${pixelIconHTML(p.id)}
      </div>
      <h3>${escapeHTML(p.name)}</h3>
      <p>${escapeHTML(p.description || "No description provided.")}</p>
      <div class="card-meta">
        <span>⬇ ${p.downloads || 0}</span>
        <span>${fmtBytes(p.size)}</span>
        <span>${timeAgo(p.uploaded)}</span>
      </div>
      <div class="card-cta">View &amp; Download →</div>
    </a>`;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* Shared topbar auth widget — every page with a #nav-account element
   gets its sign-in state filled in the same way. */
async function renderNavAccount() {
  const nav = document.getElementById("nav-account");
  if (!nav) return null;
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    nav.innerHTML = data.user
      ? `<a href="/profile.html" style="color:var(--text);font-weight:700;">${escapeHTML(data.user.name)}</a>`
      : `<a href="/login.html" style="color:var(--text);font-weight:700;">Sign in</a>`;
    return data.user;
  } catch {
    nav.innerHTML = `<a href="/login.html" style="color:var(--text);font-weight:700;">Sign in</a>`;
    return null;
  }
}
