export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  const raw = await env.PACKS_KV.get(`user:${id}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const user = JSON.parse(raw);
  const publicUser = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    joined: user.joined,
  };

  const packsRaw = await env.PACKS_KV.get("packs:index");
  const packs = packsRaw ? JSON.parse(packsRaw) : [];
  const theirPacks = packs.filter((p) => p.authorId === id);

  return new Response(JSON.stringify({ user: publicUser, packs: theirPacks }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
