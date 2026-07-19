// POST /api/delete-pack — { id } — requires a logged-in session and
// ownership of the pack. Removes the metadata entry and the stored
// file bytes from KV.

import { getCurrentUser } from "../../lib/auth.js";

function badRequest(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await getCurrentUser(request, env);
  if (!user) return badRequest("Not logged in.", 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const id = (body.id || "").toString();
  if (!id) return badRequest("Missing pack id.");

  const raw = await env.PACKS_KV.get("packs:index");
  const packs = raw ? JSON.parse(raw) : [];
  const idx = packs.findIndex((p) => p.id === id);

  if (idx === -1) return badRequest("Pack not found.", 404);
  if (packs[idx].authorId !== user.id) {
    return badRequest("You can only delete packs you uploaded.", 403);
  }

  const [removed] = packs.splice(idx, 1);
  await env.PACKS_KV.put("packs:index", JSON.stringify(packs));

  if (removed.fileKey) {
    await env.PACKS_KV.delete(removed.fileKey);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
