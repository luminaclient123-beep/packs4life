// Shared helpers for the auth system. Sessions are opaque random tokens
// stored in KV as "session:<token>" -> userId. User profiles live at
// "user:<userId>" as JSON. Email -> id lookups live at
// "user-email:<lowercased email>". Passwords are never stored in plain
// text — only a PBKDF2 hash + the salt used to produce it.

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return {
    hash: bytesToHex(new Uint8Array(bits)),
    salt: bytesToHex(salt),
  };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  // Constant-time-ish comparison to avoid trivial timing leaks.
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }
  return diff === 0;
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export async function getCurrentUser(request, env) {
  const cookies = parseCookies(request);
  const token = cookies["p4l_session"];
  if (!token) return null;

  const uid = await env.PACKS_KV.get(`session:${token}`);
  if (!uid) return null;

  const raw = await env.PACKS_KV.get(`user:${uid}`);
  if (!raw) return null;

  return JSON.parse(raw);
}

export function sessionCookie(token, maxAgeSeconds) {
  const parts = [
    `p4l_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

export function clearSessionCookie() {
  return "p4l_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}