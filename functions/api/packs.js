// GET /api/packs — returns every pack's metadata as JSON.
// Metadata lives in KV under key "packs:index" as a JSON array.
// Actual .zip bytes live in R2, keyed by pack id.

export async function onRequestGet(context) {
  const { env } = context;

  const raw = await env.PACKS_KV.get("packs:index");
  const packs = raw ? JSON.parse(raw) : [];

  return new Response(JSON.stringify(packs), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
