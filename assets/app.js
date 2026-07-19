// Packs4Life — shared client logic

const CATEGORIES = [
  "Combat", "Cursed", "Decoration", "Modded", "Realistic",
  "Simplistic", "Themed", "Tweaks", "Utility", "Vanilla Like",
];

// Real Java Edition releases through 1.21.x, then Mojang's new
// year.drop versioning that started with 26.0.
const MC_VERSIONS = [
  "26.2", "26.1", "26.0",
  "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.17",
  "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1", "1.16",
  "1.15.2", "1.15.1", "1.15",
  "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14",
  "1.13.2", "1.13.1", "1.13",
  "1.12.2", "1.12.1", "1.12",
  "1.11.2", "1.11.1", "1.11",
  "1.10.2", "1.10",
  "1.9.4", "1.9",
  "1.8.9", "1.8",
  "1.7.10", "1.7",
  "1.6.4", "1.6",
  "1.5.2", "1.5",
  "1.4.7", "1.4",
  "1.3.2", "1.3",
  "1.2.5", "1.2",
  "1.1", "1.0",
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

// Deterministic 4x4 pixel glyph per pack/user, used as a fallback
// whenever there's no uploaded thumbnail or profile picture.
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

function youtubeEmbedHTML(youtubeId) {
  if (!youtubeId) return "";
  return `<div class="yt-embed">
    <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}"
      title="Pack showcase video" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen loading="lazy"></iframe>
  </div>`;
}

function packThumbHTML(p, size) {
  const px = size || 5;
  if (p.thumbnail) {
    return `<img class="pack-thumb" src="${p.thumbnail}" alt="" style="width:${px * 4 + 16}px;height:${px * 4 + 16}px;">`;
  }
  return pixelIconHTML(p.id, px);
}

function categoryTagsHTML(categories) {
  if (!categories || !categories.length) return "";
  return `<div class="cat-tags">${categories.map(c => `<span class="cat-tag">${escapeHTML(c)}</span>`).join("")}</div>`;
}

function packCardHTML(p) {
  return `
    <a class="card" href="/pack.html?id=${encodeURIComponent(p.id)}">
      <div class="card-top">
        <span class="tag">${escapeHTML(p.version || "v1")}</span>
        ${packThumbHTML(p)}
      </div>
      <h3>${escapeHTML(p.name)}</h3>
      <p>${escapeHTML(p.description || "No description provided.")}</p>
      ${categoryTagsHTML(p.categories)}
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

/* Read a File input as a resized, compressed data URL so avatars/
   thumbnails stay well under KV's value size limits. */
function fileToResizedDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not read that image."));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality || 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
