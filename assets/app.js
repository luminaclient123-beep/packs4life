// Packs4Life — shared client logic

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

// Deterministic 4x4 pixel glyph per pack, so every pack gets a
// recognizable little "block" icon without anyone drawing it by hand.
function pixelIconHTML(seed, cellPx) {
  const px = cellPx || 5;
  const h = hashStr(seed);
  let cells = "";
  for (let i = 0; i < 16; i++) {
    const on = (h >> i) & 1;
    const bg = on ? "var(--text)" : "var(--line)";
    cells += `<i style="background:${bg}"></i>`;
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

const CATEGORY_META = {
  pvp: { emoji: "🟩", label: "PvP", cls: "category-pvp" },
  fps: { emoji: "🟦", label: "FPS", cls: "category-fps" },
  gui: { emoji: "🟪", label: "GUI", cls: "category-gui" },
  faithful: { emoji: "🟧", label: "Faithful", cls: "category-faithful" },
  horror: { emoji: "🔴", label: "Horror", cls: "category-horror" },
};

function categoryTagsHTML(categories) {
  if (!categories || !categories.length) return "";
  return `<div class="category-tags">${categories.map((c) => {
    const meta = CATEGORY_META[c];
    if (!meta) return "";
    return `<span class="cat-tag ${meta.cls}">${meta.emoji} ${meta.label}</span>`;
  }).join("")}</div>`;
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
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// --- Account menu ---------------------------------------------------
// Renders into any element (usually the topbar's #nav-account slot).
// Shows sign-in/sign-up when logged out; shows the current account,
// a quick-switch list of other linked accounts, and sign out when
// logged in. Call initAccountMenu("nav-account") once per page.

function avatarSmallHTML(user, size) {
  const px = size || 26;
  if (user.avatar) {
    return `<img src="${user.avatar}" width="${px}" height="${px}" style="border-radius:50%;object-fit:cover;flex-shrink:0;">`;
  }
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${px}px;height:${px}px;border-radius:50%;background:var(--panel-2);border:1px solid var(--line);font-size:${px * 0.4}px;font-weight:700;flex-shrink:0;">${escapeHTML((user.name || "?").charAt(0).toUpperCase())}</span>`;
}

async function initAccountMenu(elId) {
  const el = document.getElementById(elId);
  if (!el) return;

  el.style.position = "relative";

  let me = null;
  let linked = [];

  try {
    const meRes = await fetch("/api/auth/me");
    me = (await meRes.json()).user;
  } catch {}

  if (!me) {
    el.innerHTML = `
      <a href="/login.html" style="color:var(--text);font-weight:700;">Sign in</a>
      <a href="/signup.html" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;">Sign up</a>`;
    el.style.display = "flex";
    el.style.gap = "10px";
    el.style.alignItems = "center";
    el.style.border = "none";
    el.style.background = "transparent";
    el.style.padding = "0";
    return;
  }

  try {
    const linkedRes = await fetch("/api/auth/linked");
    linked = (await linkedRes.json()).accounts || [];
  } catch {}

  const others = linked.filter((a) => a.id !== me.id);

  el.style.border = "none";
  el.style.background = "transparent";
  el.style.padding = "0";
  el.style.cursor = "pointer";

  function closeMenu(e) {
    if (!el.contains(e.target)) {
      const dd = document.getElementById("account-dropdown");
      if (dd) dd.remove();
      document.removeEventListener("click", closeMenu);
    }
  }

  function renderTrigger() {
    el.innerHTML = `
      <button id="account-trigger" style="display:flex;align-items:center;gap:8px;background:var(--panel-2);border:1px solid var(--line);border-radius:20px;padding:5px 12px 5px 5px;color:var(--text);font-weight:700;font-size:12.5px;cursor:pointer;">
        ${avatarSmallHTML(me)}
        ${escapeHTML(me.name)}
      </button>`;

    document.getElementById("account-trigger").addEventListener("click", (e) => {
      e.stopPropagation();
      const existing = document.getElementById("account-dropdown");
      if (existing) { existing.remove(); return; }
      renderDropdown();
      document.addEventListener("click", closeMenu);
    });
  }

  function renderDropdown() {
    const dd = document.createElement("div");
    dd.id = "account-dropdown";
    dd.style.cssText = `position:absolute; top:calc(100% + 8px); right:0; width:240px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:8px; box-shadow:0 12px 32px rgba(0,0,0,0.5); z-index:100;`;

    let switchHTML = "";
    if (others.length) {
      switchHTML = `
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);padding:8px 10px 4px;">Switch account</div>
        ${others.map((a) => `
          <button class="dd-switch" data-id="${a.id}" style="width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:var(--text);font-size:13px;cursor:pointer;text-align:left;">
            ${avatarSmallHTML(a, 22)} ${escapeHTML(a.name)}
          </button>`).join("")}
        <div style="height:1px;background:var(--line);margin:6px 0;"></div>`;
    }

    dd.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 10px 12px;">
        ${avatarSmallHTML(me, 34)}
        <div style="overflow:hidden;">
          <div style="font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(me.name)}</div>
          <div style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(me.email || "")}</div>
        </div>
      </div>
      <a href="/profile.html" style="display:block;padding:8px 10px;border-radius:8px;color:var(--text);font-size:13px;font-weight:600;">View profile</a>
      ${switchHTML}
      <a href="/login.html" style="display:block;padding:8px 10px;border-radius:8px;color:var(--text);font-size:13px;">+ Add another account</a>
      <button id="dd-logout" style="width:100%;text-align:left;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:var(--danger);font-size:13px;cursor:pointer;">Sign out</button>
    `;

    el.appendChild(dd);

    dd.querySelectorAll(".dd-switch").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const res = await fetch("/api/auth/switch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId: btn.dataset.id }),
          });
          if (res.ok) location.reload();
        } catch {}
      });
    });

    document.getElementById("dd-logout").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.href = "/index.html";
    });

    dd.addEventListener("click", (e) => e.stopPropagation());
  }

  renderTrigger();
}
