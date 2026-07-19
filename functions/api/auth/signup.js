// POST /api/auth/signup — { name, email, password } -> creates the
// account, logs them in immediately, and returns the user.

import { randomToken, hashPassword, sessionCookie } from "../../../lib/auth.js";

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

  const name = (body.name || "").toString().trim().slice(0, 40);
  const email = (body.email || "").toString().trim().toLowerCase().slice(0, 100);
  const password = (body.password || "").toString();

  if (!name) return badRequest("Enter a display name.");
  if (!email || !email.includes("@")) return badRequest("Enter a valid email.");
  if (password.length < 8) return badRequest("Password must be at least 8 characters.");

  const emailKey = `user-email:${email}`;
  const existing = await env.PACKS_KV.get(emailKey);
  if (existing) return badRequest("An account with that email already exists.", 409);

  const id = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);

  const user = {
    id,
    name,
    email,
    passwordHash: hash,
    passwordSalt: salt,
    avatar: null,
    bio: "",
    joined: new Date().toISOString(),
  };

  await env.PACKS_KV.put(`user:${id}`, JSON.stringify(user));
  await env.PACKS_KV.put(emailKey, id);

  const token = randomToken();
  await env.PACKS_KV.put(`session:${token}`, id, { expirationTtl: SESSION_MAX_AGE });

  const { passwordHash, passwordSalt, ...publicUser } = user;

  return new Response(JSON.stringify({ user: publicUser }), {
    status: 201,
    headers: {
      "content-type": "application/json",
      "Set-Cookie": sessionCookie(token, SESSION_MAX_AGE),
    },
  });
}
