# Connect767 Build & Deployment Commands

Deploying is TWO steps. The server builds from GitHub, not from your PC —
so local changes that haven't been pushed will not appear on the site, and
the build will still succeed while serving the old code.

## Step 1 — Push from local (Windows)

In `C:\Users\PC\Desktop\connect`:

```bash
git status          # confirm your changes are listed
git add .
git commit -m "describe the change"
git push origin main
```

Verify at https://github.com/Nikola0803/connect767 before moving on.

## Step 2 — Build & deploy on the server

### ⚠️ The docroot is `/var/www/connect767.com` — NOT `/var/www/html`

Confirmed via `nginx -T`:

```
server_name connect767.com www.connect767.com;
root /var/www/connect767.com;      <-- deploy HERE

root /var/www/html;                <-- default vhost, serves nothing
server_name _;
```

`/var/www` also contains `connect767/` (an older copy) and `html/`. Both are
dead. Copying into either produces a successful build and zero visible
change — the failure mode that cost an afternoon on 2026-08-10.

### Full fresh build

```bash
cd /var/www && rm -rf connect767-src && \
git clone https://github.com/Nikola0803/connect767 connect767-src && \
cd connect767-src && npm install && npm run build && \
cp -r dist/* /var/www/connect767.com/
```

The `&&` chaining is deliberate: a failed clone or build stops the sequence
instead of copying a stale `dist/` over the live site.

### Quick rebuild (already cloned) — use this one

```bash
cd /var/www/connect767-src && \
git fetch origin && \
git reset --hard origin/main && \
npm install && \
npm run build && \
cp -r dist/* /var/www/connect767.com/
```

⚠️ **Do not use `git pull` here.** The local deploy script force-pushes to
GitHub, which rewrites history, so the VPS clone diverges on every deploy and
`pull` aborts with:

```
hint: You have divergent branches and need to specify how to reconcile them.
fatal: Need to specify how to reconcile divergent branches.
```

`fetch` + `reset --hard` means "make this copy exactly match GitHub", which is
what a deploy target wants. It can't fail on divergence and never leaves a
half-merged tree. Any local edits on the VPS are discarded — intentionally;
the VPS is a build box, not somewhere to edit code.

### Always verify — don't trust "build succeeded"

```bash
grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /var/www/connect767.com/index.html
```

Compare that hash to the one `vite build` just printed. If they differ, the
copy didn't land. Asset filenames are content-hashed, so a real deploy
ALWAYS changes the hash — if the hash is unchanged after a source change,
nothing deployed. Corollary: stale JS cannot be a caching problem, because
new code arrives under a new filename. If the hash is new and the browser
still looks old, only `index.html` is cached — hard-refresh (Ctrl+F5).

### Development Server
```bash
cd /var/www/connect767-src
npm run dev
```

### Lint Code
```bash
cd /var/www/connect767-src
npm run lint
```

### Run Tests
```bash
cd /var/www/connect767-src
npm run test
```

### Watch Tests
```bash
cd /var/www/connect767-src
npm run test:watch
```

### Preview Build
```bash
cd /var/www/connect767-src
npm run preview
```

---

## Project Details

- **Repository**: https://github.com/Nikola0803/connect767
- **Type**: React + Vite
- **Package Manager**: npm
- **Node Version**: v22.22.3+ recommended

## Build Output

Built files are in: `/var/www/connect767-src/dist/`
Deploy target: `/var/www/html/`

## Key Files

- `package.json` - Dependencies and scripts
- `vite.config.js` - Vite configuration
- `src/` - Source code
- `public/` - Static assets

## Troubleshooting

**npm install fails:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Port already in use (dev mode):**
```bash
npm run dev -- --port 3000
```

**Clear build cache:**
```bash
rm -rf dist node_modules
npm install
npm run build
```

**Build succeeds but the site looks unchanged:**
Almost always unpushed local commits — the server built the old code from
GitHub. Check `git log origin/main -1` locally vs the server, or confirm the
file on GitHub. Second most likely: browser cache on `index.html`.

**Nested `connect767-src/connect767-src`:**
Caused by re-running the clone block while already inside `connect767-src`.
The `cd /var/www` at the start of the block prevents it.
