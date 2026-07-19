import { getCurrentUser } from "../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await getCurrentUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const name = (body.name || "").toString().trim().slice(0, 40);
  const bio = (body.bio || "").toString().trim().slice(0, 300);

  if (!name) {
    return new Response(JSON.stringify({ error: "Display name can't be empty." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const updated = { ...user, name, bio };
  await env.PACKS_KV.put(`user:${user.id}`, JSON.stringify(updated));

  const { passwordHash, passwordSalt, ...publicUser } = updated;

  return new Response(JSON.stringify({ user: publicUser }), {
    headers: { "content-type": "application/json" },
  });
}
