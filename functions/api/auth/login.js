// POST /api/auth/login — { email, password } -> starts a session.

import { randomToken, verifyPassword, sessionCookie, addLinkedToken } from "../../../lib/auth.js";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function badRequest(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!email || !password) return badRequest("Enter your email and password.");

  const id = await env.PACKS_KV.get(`user-email:${email}`);
  if (!id) return badRequest("No account with that email, or wrong password.", 401);

  const raw = await env.PACKS_KV.get(`user:${id}`);
  if (!raw) return badRequest("No account with that email, or wrong password.", 401);

  const user = JSON.parse(raw);
  const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!ok) return badRequest("No account with that email, or wrong password.", 401);

  const token = randomToken();
  await env.PACKS_KV.put(`session:${token}`, id, { expirationTtl: SESSION_MAX_AGE });

  const { passwordHash, passwordSalt, ...publicUser } = user;

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", sessionCookie(token, SESSION_MAX_AGE));
  headers.append("Set-Cookie", addLinkedToken(request, token, SESSION_MAX_AGE));

  return new Response(JSON.stringify({ user: publicUser }), { headers });
}
