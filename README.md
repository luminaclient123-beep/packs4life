# Packs4Life

A community texture pack hub. Static HTML/CSS frontend + Cloudflare Pages
Functions backend. Anyone can upload a `.zip` pack; it's stored in R2 and
immediately shows up for everyone on `/packs.html`.

## Structure

```
index.html          Home page
packs.html           Browse / search all packs
upload.html          Upload form
pack.html            Single pack detail + download button
assets/style.css     All styling
assets/app.js         Shared client logic (fetch packs, render cards)
functions/api/packs.js            GET  /api/packs        -> list all packs
functions/api/upload.js           POST /api/upload        -> upload a pack
functions/api/download/[id].js    GET  /api/download/:id  -> download a pack's zip
wrangler.toml         Cloudflare bindings config
```

## How storage works

- **R2 bucket** (`PACKS_BUCKET`) holds the actual `.zip` files.
- **KV namespace** (`PACKS_KV`) holds one JSON key, `packs:index`, which is
  an array of every pack's metadata (name, version, author, description,
  size, download count, upload date). The whole site reads from this one
  key, so every visitor sees the same list — that's the "cloud" part.

No database, no accounts. It's intentionally simple so it fits inside
Cloudflare's free tier for small/medium communities.

## Deploying on Cloudflare Pages

1. **Push this folder to a GitHub repo.**

2. **Create the R2 bucket:**
   ```
   npx wrangler r2 bucket create packs4life-files
   ```

3. **Create the KV namespace:**
   ```
   npx wrangler kv namespace create PACKS_KV
   ```
   This prints an `id`. Put it into `wrangler.toml` in place of
   `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

4. **Create the Pages project** in the Cloudflare dashboard:
   Workers & Pages → Create → Pages → Connect to Git → pick this repo.
   - Build command: (leave blank — it's static)
   - Build output directory: `/`

5. **Add the bindings** on the Pages project, under
   Settings → Functions:
   - R2 bucket binding: variable name `PACKS_BUCKET` → bucket `packs4life-files`
   - KV namespace binding: variable name `PACKS_KV` → the namespace you created

6. **Redeploy** after adding bindings (bindings only apply to new deployments).

That's it — uploads on the live site will now persist in R2/KV and be
visible to every visitor.

## Local development

```
npx wrangler pages dev . --r2=PACKS_BUCKET --kv=PACKS_KV
```

## Notes / limits

- Upload cap is 200MB per file (adjustable in `functions/api/upload.js`).
- The KV index keeps the most recent 500 packs; older ones roll off the
  list (files stay in R2, only the index trims). Raise `MAX_LIST` in
  `upload.js` if you need more.
- There's no moderation queue — anything uploaded appears instantly. If
  you want review-before-publish later, that just means writing new
  uploads to a `pending:` key instead of `packs:index` and adding an
  admin action to promote them.
