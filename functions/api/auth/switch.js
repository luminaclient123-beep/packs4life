// POST /api/auth/switch — { userId } -> makes that account's linked
// token the active session, without needing to re-enter a password.

import { parseLinkedTokens, sessionCookie } from "../../../lib/auth.js";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const userId = (body.userId || "").toString();
  const tokens = parseLinkedTokens(request);

  for (const token of tokens) {
    const uid = await env.PACKS_KV.get(`session:${token}`);
    if (uid === userId) {
      const raw = await env.PACKS_KV.get(`user:${uid}`);
      if (!raw) break;
      const { passwordHash, passwordSalt, ...publicUser } = JSON.parse(raw);

      return new Response(JSON.stringify({ user: publicUser }), {
        headers: {
          "content-type": "application/json",
          "Set-Cookie": sessionCookie(token, SESSION_MAX_AGE),
        },
      });
    }
  }

  return new Response(JSON.stringify({ error: "That account isn't linked in this browser. Sign in with its password instead." }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
