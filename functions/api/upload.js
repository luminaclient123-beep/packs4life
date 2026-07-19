// POST /api/upload — requires a logged-in session. Accepts
// multipart/form-data: name, version, description, categories (csv),
// youtube (optional URL), thumbnail (optional image), file (.zip).
// The author is taken from the logged-in account, not user input.

import { getCurrentUser } from "../../lib/auth.js";

const MAX_BYTES = 18 * 1024 * 1024; // 18MB raw file cap (safe under KV's 25MB value limit after base64)
const MAX_THUMB_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw thumbnail cap
const MAX_LIST = 500; // cap how many packs we keep listed, oldest fall off

const VALID_CATEGORIES = [
  "Combat", "Cursed", "Decoration", "Modded", "Realistic",
  "Simplistic", "Themed", "Tweaks", "Utility", "Vanilla Like",
];

function badRequest(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function slugify(name, id) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "pack"}-${id.slice(0, 6)}`;
}

// Convert an ArrayBuffer to base64 without blowing the call stack on
// large files (chunked to avoid String.fromCharCode argument limits).
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function extractYoutubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await getCurrentUser(request, env);
  if (!user) {
    return badRequest("You need to sign in before uploading a pack.", 401);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Could not read the upload. Try again.");
  }

  const name = (form.get("name") || "").toString().trim();
  const version = (form.get("version") || "").toString().trim();
  const description = (form.get("description") || "").toString().trim();
  const youtubeRaw = (form.get("youtube") || "").toString().trim();
  const categoriesRaw = (form.get("categories") || "").toString().trim();
  const file = form.get("file");
  const thumbnail = form.get("thumbnail");

  if (!name || !version || !description) {
    return badRequest("Missing one of: name, version, description.");
  }
  if (!(file instanceof File)) {
    return badRequest("No file was attached.");
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return badRequest("Only .zip files are accepted.");
  }
  if (file.size > MAX_BYTES) {
    return badRequest("File is over the 18MB limit.");
  }

  const categories = categoriesRaw
    ? categoriesRaw.split(",").map((c) => c.trim()).filter((c) => VALID_CATEGORIES.includes(c))
    : [];

  const youtubeId = extractYoutubeId(youtubeRaw);
  if (youtubeRaw && !youtubeId) {
    return badRequest("That doesn't look like a valid YouTube link.");
  }

  const id = crypto.randomUUID();
  const fileKey = `file:${id}`;

  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  await env.PACKS_KV.put(fileKey, base64);

  let thumbnailDataUrl = null;
  if (thumbnail instanceof File && thumbnail.size > 0) {
    if (thumbnail.size > MAX_THUMB_BYTES) {
      return badRequest("Thumbnail image is over the 1.5MB limit.");
    }
    if (!thumbnail.type.startsWith("image/")) {
      return badRequest("Thumbnail must be an image file.");
    }
    const thumbBuffer = await thumbnail.arrayBuffer();
    thumbnailDataUrl = `data:${thumbnail.type};base64,${arrayBufferToBase64(thumbBuffer)}`;
  }

  const record = {
    id,
    slug: slugify(name, id),
    name: name.slice(0, 60),
    version: version.slice(0, 20),
    authorId: user.id,
    author: user.name,
    description: description.slice(0, 400),
    categories,
    youtubeId,
    thumbnail: thumbnailDataUrl,
    size: file.size,
    fileKey,
    downloads: 0,
    uploaded: new Date().toISOString(),
  };

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
