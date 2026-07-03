import { getCurrentUser } from "../../../lib/auth.js";

export async function onRequestGet(context) {
  const user = await getCurrentUser(context.request, context.env);
  const publicUser = user ? (({ passwordHash, passwordSalt, ...rest }) => rest)(user) : null;
  return new Response(JSON.stringify({ user: publicUser }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
