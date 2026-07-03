// POST /api/profile-avatar — multipart/form-data with a single "avatar"
// image file. Stores it as a base64 data URL directly on the user
// record (kept small — 2MB raw cap — since it lives inside the same
// KV value as the rest of the profile).

import { getCurrentUser } from "../../lib/auth.js";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await getCurrentUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Could not read the upload." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const file = form.get("avatar");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No image attached." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(JSON.stringify({ error: "Use a PNG, JPG, WEBP, or GIF." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "Image is over the 2MB limit." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const dataUrl = `data:${file.type};base64,${base64}`;

  const updated = { ...user, avatar: dataUrl };
  await env.PACKS_KV.put(`user:${user.id}`, JSON.stringify(updated));

  const { passwordHash, passwordSalt, ...publicUser } = updated;

  return new Response(JSON.stringify({ user: publicUser }), {
    headers: { "content-type": "application/json" },
  });
}
