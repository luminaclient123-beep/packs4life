// GET /api/download/:id — streams the zip from R2 and bumps the
// download counter in the KV index.

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
  const object = await env.PACKS_BUCKET.get(record.objectKey);

  if (!object) {
    return new Response("File missing from storage.", { status: 404 });
  }

  // Fire-and-forget the counter bump so the download itself isn't delayed.
  packs[idx].downloads = (record.downloads || 0) + 1;
  context.waitUntil(env.PACKS_KV.put("packs:index", JSON.stringify(packs)));

  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set("content-disposition", `attachment; filename="${record.slug}.zip"`);
  headers.set("cache-control", "no-store");

  return new Response(object.body, { headers });
}
