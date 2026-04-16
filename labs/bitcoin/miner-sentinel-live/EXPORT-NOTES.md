# Miner Sentinel Live — Export Notes

**Checkpoint:** Station #1 Foundation  
**Intended deployment path:** `/labs/bitcoin/miner-sentinel-live/`  
**Build date:** April 2026

---

## Files in this export

### `miner-sentinel-live-station-1-foundation-source.zip`
**Use this for GitHub / source import.**

Contains the full project source: all TypeScript, React components, live data integration, Vite config, and checkpoint documentation. Import this into a GitHub repository. To build from source, the pnpm workspace root must be present — see `docs/checkpoint-station-1-foundation.md` for full build instructions and the complete list of what is implemented at this checkpoint.

### `miner-sentinel-live-station-1-foundation-deploy.zip`
**Use this for direct website deployment.**

Contains only the production build output — pre-built HTML, CSS, JavaScript, and static assets. Upload the contents of this zip directly to the `/labs/bitcoin/miner-sentinel-live/` path on the target host (GitHub Pages, Netlify, Nginx, S3, etc.). No build step required. No Node.js required on the server.

---

## Deployment path

All asset references inside the deploy zip are already prefixed for:

```
/labs/bitcoin/miner-sentinel-live/
```

Do not move the files to a different path without rebuilding with a different `BASE_PATH`.

---

## Live data

The deployed app connects directly to `https://mempool.space/api` from the visitor's browser. No server-side proxy is required. No API key is required. If the API is unreachable, the app automatically falls back to demo mode.
