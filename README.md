# Packs4Life

A community texture pack hub with accounts. Static HTML/CSS frontend +
Cloudflare Pages Functions backend. Anyone can browse and download;
uploading requires a free Packs4Life account (email + password), and
every account gets a profile page listing their packs.

## Structure

```
index.html, packs.html, upload.html, pack.html   Public pages
login.html, signup.html, profile.html             Account pages
assets/style.css, assets/app.js                    Shared styling / client logic
lib/auth.js                                        Sessions, cookies, password hashing
functions/api/packs.js               GET  /api/packs             list all packs
functions/api/upload.js              POST /api/upload             upload a pack (requires login)
functions/api/download/[id].js       GET  /api/download/:id       download a pack's zip
functions/api/auth/signup.js         POST /api/auth/signup        create an account
functions/api/auth/login.js          POST /api/auth/login         sign in
functions/api/auth/me.js             GET  /api/auth/me            current logged-in user
functions/api/auth/logout.js         POST /api/auth/logout        sign out
functions/api/profile/[id].js        GET  /api/profile/:id        public profile + their packs
functions/api/profile-update.js      POST /api/profile-update     edit your own name/bio
wrangler.toml                        Cloudflare bindings config
```

## Storage

Everything lives in one **KV namespace** (`PACKS_KV`) — no external
accounts, no third-party login provider, nothing to configure outside
Cloudflare itself:

- `packs:index` — JSON array of every pack's metadata
- `file:<id>` — a pack's zip, base64-encoded (18MB raw file cap)
- `user:<id>` — a user's profile: name, email, password hash + salt, bio
- `user-email:<email>` — maps an email to a user id, for login lookups
- `session:<token>` — maps a session token to a user, expires after 30 days

## How accounts work

- Signup takes a name, email, and password (min 8 characters).
- Passwords are **never stored in plain text** — only a PBKDF2-SHA256
  hash (100,000 iterations) plus the random salt used to produce it,
  via the Web Crypto API built into Cloudflare Workers.
- Sessions are random 32-byte tokens stored in KV and referenced by an
  `HttpOnly`, `Secure` cookie — not readable by page JavaScript, not
  vulnerable to basic XSS token theft.
- Uploading is blocked **server-side** if you're not logged in (checked
  in `functions/api/upload.js`), not just hidden in the UI, so it can't
  be bypassed by editing the page.

This is intentionally simple and has no external dependencies — no
Google, no OAuth setup, no extra accounts needed beyond Cloudflare and
GitHub. The tradeoff versus something like Google sign-in: no "forgot
password" flow, no email verification, and you're fully responsible for
this being the entire security model. Fine for a small community hub;
if it grows a lot, look at adding email verification and possibly a
password reset flow (would need an email-sending service, e.g.
Cloudflare Email Workers or a third-party API).

## Deploying on Cloudflare Pages

1. **Push this folder to a GitHub repo.**

2. **Create the KV namespace** (skip if you already have one from a
   previous version):
   ```
   npx wrangler kv namespace create PACKS_KV
   ```
   Put the printed `id` into `wrangler.toml`, in quotes.

3. **Create the Pages project** in the Cloudflare dashboard:
   Workers & Pages → Create → Pages → Connect to Git → pick this repo.
   - Build command: leave blank
   - Build output directory: `/`

4. **Add the KV binding** — Settings → Functions → KV namespace
   bindings → variable name `PACKS_KV` → your namespace.

5. **Redeploy** (Deployments tab → Retry deployment) so the binding
   takes effect.

No environment variables or third-party credentials needed — this
version doesn't talk to Google or anything outside Cloudflare.

## Local development

```
npx wrangler pages dev . --kv=PACKS_KV
```

## Customizing

See the comment block at the top of `assets/style.css` for quick
pointers on changing colors, fonts, and the logo mark.

## Notes

- No moderation queue — uploads appear instantly for any signed-in user.
- No email verification — anyone can sign up with any email address
  they type in (it's not checked as belonging to them).
- The KV index keeps the most recent 500 packs; older ones roll off
  the list (their file keys stay in KV, only the index trims). Raise
  `MAX_LIST` in `upload.js` if you need more.
