// GET /api/auth/linked — returns the accounts this browser has signed
// into before (from the p4l_linked cookie), so the UI can show a quick
// account switcher. Never exposes raw tokens to the client.

import { parseLinkedTokens, parseCookies } from "../../../lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const tokens = parseLinkedTokens(request);
  const activeToken = parseCookies(request)["p4l_session"] || null;

  const accounts = [];
  const seen = new Set();

  for (const token of tokens) {
    const uid = await env.PACKS_KV.get(`session:${token}`);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);

    const raw = await env.PACKS_KV.get(`user:${uid}`);
    if (!raw) continue;
    const user = JSON.parse(raw);

    accounts.push({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      active: token === activeToken,
    });
  }

  return new Response(JSON.stringify({ accounts }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
