import { parseCookies, clearSessionCookie } from "../../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies["p4l_session"];

  if (token) {
    await env.PACKS_KV.delete(`session:${token}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
