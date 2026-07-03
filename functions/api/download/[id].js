// GET /api/download/:id — reads the base64 zip out of KV, decodes it,
// streams it back, and bumps the download counter in the index.

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  const raw = await env.PACKS_KV.get("packs:index");
  const packs = raw ? JSON.parse(raw) : [];
  const idx = packs.findIndex((p) => p.id === id);

  if (idx === -1) {
    return new Response("Pack not found.", { status: 404 });
  }

  const record = packs[idx];
  const base64 = await env.PACKS_KV.get(record.fileKey);

  if (!base64) {
    return new Response("File missing from storage.", { status: 404 });
  }

  const bytes = base64ToBytes(base64);

  // Fire-and-forget the counter bump so the download itself isn't delayed.
  packs[idx].downloads = (record.downloads || 0) + 1;
  context.waitUntil(env.PACKS_KV.put("packs:index", JSON.stringify(packs)));

  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${record.slug}.zip"`);
  headers.set("cache-control", "no-store");

  return new Response(bytes, { headers });
}
