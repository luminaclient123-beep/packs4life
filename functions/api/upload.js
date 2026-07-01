// POST /api/upload — accepts multipart/form-data: name, version, author,
// description, file (.zip). Stores the zip in R2 and appends metadata to
// the KV index so it immediately shows up for everyone hitting /api/packs.

const MAX_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_LIST = 500; // cap how many packs we keep listed, oldest fall off

function badRequest(msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

function slugify(name, id) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "pack"}-${id.slice(0, 6)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Could not read the upload. Try again.");
  }

  const name = (form.get("name") || "").toString().trim();
  const version = (form.get("version") || "").toString().trim();
  const author = (form.get("author") || "").toString().trim();
  const description = (form.get("description") || "").toString().trim();
  const file = form.get("file");

  if (!name || !version || !author || !description) {
    return badRequest("Missing one of: name, version, author, description.");
  }
  if (!(file instanceof File)) {
    return badRequest("No file was attached.");
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return badRequest("Only .zip files are accepted.");
  }
  if (file.size > MAX_BYTES) {
    return badRequest("File is over the 200MB limit.");
  }

  const id = crypto.randomUUID();
  const objectKey = `${id}.zip`;

  // Store the actual file bytes in R2.
  await env.PACKS_BUCKET.put(objectKey, file.stream(), {
    httpMetadata: { contentType: "application/zip" },
  });

  const record = {
    id,
    slug: slugify(name, id),
    name: name.slice(0, 60),
    version: version.slice(0, 20),
    author: author.slice(0, 40),
    description: description.slice(0, 400),
    size: file.size,
    objectKey,
    downloads: 0,
    uploaded: new Date().toISOString(),
  };

  // Append to the shared index. KV has no atomic array append, so we
  // read-modify-write; last write wins under concurrent uploads, which
  // is an acceptable tradeoff for a community hub at this scale.
  const raw = await env.PACKS_KV.get("packs:index");
  const packs = raw ? JSON.parse(raw) : [];
  packs.unshift(record);
  if (packs.length > MAX_LIST) packs.length = MAX_LIST;

  await env.PACKS_KV.put("packs:index", JSON.stringify(packs));

  return new Response(JSON.stringify({ id: record.id, slug: record.slug }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}
