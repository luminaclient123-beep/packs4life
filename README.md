# Packs4Life

A Minecraft texture pack site. People can browse and download without an
account; uploading requires a free account. Static HTML/CSS frontend +
Cloudflare Pages Functions backend, all storage in one Cloudflare KV
namespace — no other services involved.

## What's in this version

- **Black / purple / white theme** — see `assets/style.css`, tokens at
  the top of the file.
- **Categories** — PvP, FPS, GUI, Faithful, Horror. Required when
  uploading, shown as colored badges on every pack card, filterable on
  the browse page.
- **Accounts** — email + password signup/login, profile pages with a
  bio and an uploadable avatar, display names must be unique.
- **Quick account switching** — sign into a second account without
  logging out of the first; switch between them from the account menu
  in the top-right of every page.
- Search and sort actually work now (see "what was broken" below).

## Structure

```
index.html, packs.html, upload.html, pack.html    Public pages
login.html, signup.html, profile.html              Account pages
assets/style.css                                    All styling + design tokens
assets/app.js                                        Shared client logic: card rendering,
                                                       category tags, the account-switcher menu
lib/auth.js                                          Sessions, cookies, password hashing,
                                                       linked-account helpers
functions/api/packs.js               GET  /api/packs
functions/api/upload.js              POST /api/upload            (requires login + a category)
functions/api/download/[id].js       GET  /api/download/:id
functions/api/auth/signup.js         POST /api/auth/signup       (checks name + email uniqueness)
functions/api/auth/login.js          POST /api/auth/login
functions/api/auth/logout.js         POST /api/auth/logout
functions/api/auth/me.js             GET  /api/auth/me
functions/api/auth/linked.js         GET  /api/auth/linked        list of quick-switch accounts
functions/api/auth/switch.js         POST /api/auth/switch        swap active account
functions/api/profile/[id].js        GET  /api/profile/:id        public profile + their packs
functions/api/profile-update.js      POST /api/profile-update     name/bio (name must be unique)
functions/api/profile-avatar.js      POST /api/profile-avatar     upload a profile picture
wrangler.toml                        Cloudflare bindings config
```

## What was actually broken (and the fix)

**Search/sort not working on the browse page:** a stray duplicated
line had created a broken, unclosed function in `packs.html`. That's a
JavaScript syntax error, and a syntax error anywhere in a `<script>`
block stops the *entire* block from running — not just the broken
part. That's why nothing on the page worked, not just search. Fixed.

**Green hover on "Browse the hub":** a leftover color from the very
first version of the site (`#a9ec5a`) never got updated in earlier
color passes. Found and replaced with the new purple.

**Uploaded packs disappearing after a redeploy:** this isn't a code
bug — it's almost certainly a Cloudflare Pages configuration issue.
Cloudflare Pages has **separate KV bindings for Production and Preview
deployments**. If your project was serving traffic as a Preview
deployment at some point (this happened earlier in this project's
history — the production branch setting was briefly wrong) and KV was
only bound for Production, anything uploaded during that window landed
in a namespace the live site can't see. There's no way to recover data
that was written under a binding that's since been disconnected.
**To prevent it happening again:** go to your Pages project →
Settings → Functions → and make sure the `PACKS_KV` binding is added
for **both** Production and Preview, and double check Settings →
Builds & deployments → Production branch matches the branch you
actually push to.

## How storage works

Everything lives in one **KV namespace** (`PACKS_KV`):

- `packs:index` — JSON array of every pack's metadata, including its
  `categories` array
- `file:<id>` — a pack's zip, base64-encoded (18MB raw file cap)
- `user:<id>` — a user's profile: name, email, password hash + salt,
  bio, avatar (base64 data URL, 2MB cap)
- `user-email:<email>` — maps an email to a user id (signup/login lookup)
- `username:<lowercased name>` — maps a display name to a user id
  (enforces uniqueness)
- `session:<token>` — maps a session token to a user, 30-day expiry

## How quick account switching works

On login/signup, the new session token is added to an `HttpOnly`
cookie (`p4l_linked`) holding up to 5 recent tokens — the browser never
sees the raw tokens, only account names/avatars via `/api/auth/linked`.
Clicking another account in the switcher calls `/api/auth/switch`,
which looks up the matching token server-side and makes it the active
session. Signing out fully invalidates that session, so a signed-out
account drops out of the switcher until you log into it again.

## Known limitation

If someone changes their display name, texture packs they uploaded
**before** the change still show their old name (the pack record
stores a snapshot of the author's name at upload time, not a live
reference). Their profile page and new uploads use the current name.
Fixing this fully would mean looking the author up by id everywhere
packs are displayed instead of storing the name — a reasonable future
improvement, flagging it now rather than pretending it's not there.

## Deploying / updating

1. Push this folder to your GitHub repo, replacing the old files.
2. Cloudflare Pages will redeploy automatically if it's connected.
3. Confirm the `PACKS_KV` binding exists for **both** Production and
   Preview under Settings → Functions (see the bug note above).
4. If anything looks stale after deploying, hard refresh
   (`Ctrl+Shift+R`) — browsers cache CSS/JS aggressively.

## Local development

```
npx wrangler pages dev . --kv=PACKS_KV
```

## Customizing

Color tokens, fonts, and the logo mark are all documented in the
comment block at the top of `assets/style.css`. Category colors are
separate, further down in the same file, so they stay fixed regardless
of the site's accent color.
