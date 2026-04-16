# Miner Sentinel Live — Deployment Instructions

**Checkpoint:** Station #1 Foundation  
**Deployment path:** `/labs/bitcoin/miner-sentinel-live/`

---

## What is in this ZIP

This ZIP contains a fully pre-built static web app.  
There is no build step required. No Node.js. No server.

Contents:

```
index.html
favicon.svg
opengraph.jpg
assets/
  index-[hash].js    ← all application JavaScript, minified
  index-[hash].css   ← all styles, minified
DEPLOY.md            ← this file
```

All asset paths inside `index.html` already reference:

```
/labs/bitcoin/miner-sentinel-live/assets/...
```

Do not move these files to a different path without rebuilding.

---

## How to deploy to GitHub Pages

### Step 1 — Prepare your GitHub Pages repo

You need a repository that is served as a GitHub Pages site.  
This can be a dedicated `<username>.github.io` repo, or any repo with GitHub Pages enabled on a branch (typically `gh-pages` or `docs/`).

If using a custom domain (e.g. `satoshium.io`), your Pages site serves from the domain root.

### Step 2 — Place the files at the correct path

Inside your GitHub Pages repository, create this folder structure:

```
labs/
  bitcoin/
    miner-sentinel-live/
      index.html          ← from this ZIP
      favicon.svg         ← from this ZIP
      opengraph.jpg       ← from this ZIP
      assets/
        index-[hash].js   ← from this ZIP
        index-[hash].css  ← from this ZIP
```

Everything from this ZIP goes inside the `labs/bitcoin/miner-sentinel-live/` folder.

### Step 3 — Commit and push

```bash
git add labs/bitcoin/miner-sentinel-live/
git commit -m "Deploy Miner Sentinel Live — Station #1 Foundation"
git push
```

### Step 4 — Visit the app

Once GitHub Pages has deployed (usually within 60 seconds):

```
https://your-domain.com/labs/bitcoin/miner-sentinel-live/
```

The app connects to Bitcoin mainnet data automatically.  
If the network is unreachable, it falls back to demo mode with no errors shown.

---

## No 404 / SPA redirect needed

This app has a single page with no client-side routing to deep URLs.  
Every visitor lands at `index.html`. GitHub Pages serves it directly.  
No `404.html` redirect trick is required.

---

## Live data

The app fetches live Bitcoin block data from `mempool.space` directly in the browser.  
No server, no proxy, and no API key are required.  
The mempool.space API allows cross-origin requests from any domain.
