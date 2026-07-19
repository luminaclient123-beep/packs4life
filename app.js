/* Packs4Life — shared client logic */

async function fetchPacks() {
  const res = await fetch("/api/packs");
  if (!res.ok) throw new Error("Failed to load packs");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.packs || []);
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 100 ? Math.round(n) : n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function timeAgo(iso) {
  if (!iso) return "some time ago";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* Deterministic little 4x4 "pixel art" icon seeded from the pack id,
   so every pack gets a stable, distinct glyph without needing real art. */
function pixelIconHTML(seed) {
  const palette = ["#35ff87", "#8dffb8", "#12b558", "#0a4d28", "rgba(255,255,255,.9)"];
  let h = 0;
  const s = String(seed || "pack");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;

  const cells = [];
  for (let i = 0; i < 16; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const on = (h >> 5) % 3 !== 0;
    const color = palette[(h >> 9) % palette.length];
    cells.push(
      `<i style="background:${on ? color : "transparent"};opacity:${on ? (0.55 + ((h >> 13) % 45) / 100) : 0}"></i>`
    );
  }
  return `<div class="pixel-icon">${cells.join("")}</div>`;
}

function packCardHTML(p) {
  return `
    <a class="pack-card" href="/pack.html?id=${encodeURIComponent(p.id)}">
      <div class="pack-card-top">
        ${pixelIconHTML(p.id)}
        <div>
          <h3 class="pack-card-name">${escapeHTML(p.name)}</h3>
          <span class="tag" style="margin-top:6px;display:inline-block;">${escapeHTML(p.version || "v1")}</span>
        </div>
      </div>
      <p class="pack-card-desc">${escapeHTML(p.description || "No description provided.")}</p>
      <div class="card-meta">
        <span>⬇ ${p.downloads || 0}</span>
        <span>${fmtBytes(p.size)}</span>
        <span>${timeAgo(p.uploaded)}</span>
      </div>
    </a>`;
}
